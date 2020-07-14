const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

/**
 * Creation of Environment Type Configuration requires specifying mapping between AWS CloudFormation Input Parameters
 * and predefined values. Many times, the values are not available at the time of creating this mapping. In such cases,
 * a variable expression in the form of ${variableName} can be specified in place of the value.
 * The Environment Type Configuration Variables denote all such variables that can be referenced in the variable
 * expressions.
 *
 * This service provides list of RaaS specific Environment Type Configuration Variables
 */
class EnvironmentConfigVarsService extends Service {
  constructor() {
    super();
    this.dependency([
      'environmentScService',
      'indexesService',
      'awsAccountsService',
      'environmentAmiService',
      'envTypeConfigService',
      'environmentMountService',
    ]);
  }

  // eslint-disable-next-line no-unused-vars
  async list(requestContext) {
    return [
      {
        name: 'envId',
        desc: 'A unique identifier for the environment assigned at the time of launching the environment',
      },
      {
        name: 'envTypeId',
        desc: 'Id of this environment type',
      },
      {
        name: 'envTypeConfigId',
        desc: 'Id of this configuration',
      },
      { name: 'name', desc: 'Name of the environment specified at the time of launching the environment' },
      {
        name: 'description',
        desc: 'Description of the environment specified at the time of launching the environment',
      },
      { name: 'accountId', desc: 'AWS Account ID of the target account where the environment is launched' },
      { name: 'projectId', desc: 'Project Id associated with the environment' },
      { name: 'indexId', desc: 'Index Id (Cost Center Id) associated with the environment' },
      { name: 'cidr', desc: 'The IP CIDR range specified at the time launching the environment' },
      {
        name: 'vpcId',
        desc: 'Vpc Id in the target account to launch environments into',
      },
      {
        name: 'subnetId',
        desc: 'Subnet Id in the target account to launch environments into',
      },
      {
        name: 'encryptionKeyArn',
        desc: 'ARN of the KMS key used for encrypting data',
      },
      {
        name: 'xAccEnvMgmtRoleArn',
        desc: 'Arn of the role used for managing environments in the target account using AWS Service Catalog',
      },
      {
        name: 'externalId',
        desc: 'External Id required to assumed the WS Service Catalog Admin role in the target account',
      },
      { name: 'studyIds', desc: 'Comma separated list of study ids associated with the environment (if any)' },
      {
        name: 's3Mounts',
        desc:
          'A JSON array of objects with name, bucket and prefix properties used to mount data from S3 based on the associated studies',
      },
      { name: 's3Prefixes', desc: 'A JSON array of S3 prefixes based on the associated studies' },
      { name: 'iamPolicyDocument', desc: 'The IAM policy to be associated with the launched environment workstation' },
      {
        name: 'environmentInstanceFiles',
        desc:
          'An S3 URI (starting with "s3://") that specifies the location of files to be copied to the environment ' +
          'instance, including any bootstrap scripts',
      },
      {
        name: 'username',
        desc: 'Username of the user launching the environment',
      },
      {
        name: 'userNamespace',
        desc:
          'Namespace of the username launching the environment. The userNamespace is derived based on the identity provider which authenticated the user',
      },
    ];
  }

  async resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId }) {
    const [
      environmentScService,
      indexesService,
      awsAccountsService,
      environmentAmiService,
      envTypeConfigService,
      environmentMountService,
    ] = await this.service([
      'environmentScService',
      'indexesService',
      'awsAccountsService',
      'environmentAmiService',
      'envTypeConfigService',
      'environmentMountService',
    ]);
    const environment = await environmentScService.mustFind(requestContext, { id: envId });

    const { name, description, projectId, indexId, cidr, studyIds } = environment;

    // // Get the aws account information
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });

    const {
      xAccEnvMgmtRoleArn,
      externalId,
      accountId,
      vpcId,
      subnetId,
      encryptionKeyArn,
    } = await awsAccountsService.mustFind(requestContext, { id: awsAccountId });

    // Check launch pre-requisites
    if (!(xAccEnvMgmtRoleArn && externalId && accountId && vpcId && subnetId && encryptionKeyArn)) {
      const cause = this.getConfigError(xAccEnvMgmtRoleArn, externalId, accountId, vpcId, subnetId, encryptionKeyArn);
      throw this.boom.badRequest(`Index "${indexId}" has not been correctly configured: missing ${cause}.`, true);
    }

    // Get the environment type configuration and read params to find if any of the params
    // require AMI ids (i.e., all param names starting with "AMI" or "ami")
    const envTypeConfig = await envTypeConfigService.mustFind(requestContext, envTypeId, { id: envTypeConfigId });
    const amiRelatedParams = _.filter(
      envTypeConfig.params,
      p => _.startsWith(p.key, 'ami') || _.startsWith(p.key, 'AMI'),
    );

    // TODO: Move this later in the workflow after all param expressions
    //  have been resolved
    const amisToShare = _.map(amiRelatedParams, p => p.value);

    if (!_.isEmpty(amisToShare)) {
      // Share AMIs with the target account (process in batches of 5 at a time)
      // if there are more than 5
      await processInBatches(amisToShare, 5, imageId =>
        environmentAmiService.ensurePermissions({ imageId, accountId }),
      );
    }

    const {
      s3Mounts,
      iamPolicyDocument,
      environmentInstanceFiles,
      s3Prefixes,
    } = await environmentMountService.getS3MountsInfo(requestContext, studyIds);

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    return {
      envId,
      envTypeId,
      envTypeConfigId,
      name,
      description,
      accountId,
      projectId,
      indexId,
      studyIds,
      cidr,
      vpcId,
      subnetId,
      encryptionKeyArn,
      xAccEnvMgmtRoleArn,
      externalId,

      s3Mounts,
      iamPolicyDocument,
      environmentInstanceFiles,
      s3Prefixes,

      username: by.username,
      userNamespace: by.ns,
    };
  }

  async getDefaultTags(requestContext, resolvedVars) {
    return [
      {
        Key: 'Description',
        Value: `Created by ${resolvedVars.username}`,
      },
      {
        Key: 'Env',
        Value: resolvedVars.envId,
      },
      {
        Key: 'Proj',
        Value: resolvedVars.projectId,
      },
      {
        Key: 'CreatedBy',
        Value: resolvedVars.username,
      },
    ];
  }

  getConfigError(xAccEnvMgmtRoleArn, roleExternalId, accountId, vpcId, subnetId, encryptionKeyArn) {
    const causes = [];

    if (!xAccEnvMgmtRoleArn) causes.push('AWS Service Catalog Role Arn');
    if (!roleExternalId) causes.push('External ID');
    if (!accountId) causes.push('AWS account ID');
    if (!vpcId) causes.push('VPC ID');
    if (!subnetId) causes.push('VPC Subnet ID');
    if (!encryptionKeyArn) causes.push('Encryption Key ARN');

    if (causes.length > 1) {
      const last = causes.pop();
      return `${causes.join(', ')} and ${last}`;
    }
    if (causes.length > 0) {
      return causes[0];
    }

    return undefined;
  }
}
module.exports = EnvironmentConfigVarsService;
