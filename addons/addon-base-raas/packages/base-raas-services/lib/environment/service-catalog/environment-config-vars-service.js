/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

const { StudyPolicy } = require('../../helpers/iam/study-policy');

const settingKeys = {
  environmentInstanceFiles: 'environmentInstanceFiles',
};

/**
 * Creation of Environment Type Configuration requires specifying mapping between AWS CloudFormation Input Parameters
 * and predefined values. Many times, the values are not available at the time of creating this mapping. In such cases,
 * a variable expression in the form of ${variableName} can be specified in place of the value.
 * The Environment Type Configuration Variables denote all such variables that can be referenced in the variable
 * expressions.
 *
 * This service provides list of Service Workbench specific Environment Type Configuration Variables
 */
class EnvironmentConfigVarsService extends Service {
  constructor() {
    super();
    this.dependency([
      'userService',
      'environmentScService',
      'environmentScKeypairService',
      'indexesService',
      'awsAccountsService',
      'environmentAmiService',
      'envTypeConfigService',
      'studyService',
      'pluginRegistryService',
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
      {
        name: 'adminKeyPairName',
        desc:
          'AWS EC2 Key Pair Name for environment administration (useful for Windows based environments).' +
          ' If you use this variable, a new EC2 key pair will be created at the time of launching the environment and' +
          " the key pair's name will be passed via this variable. Use this variable ONLY IF you want to " +
          'specify a static key pair. This may be required for ' +
          "Windows based instances to retrieve default Administrator user's password. You do not need to use any key " +
          'pair for SSH if you are launching instances that have EC2 ' +
          'Instance Connect Agent (Amazon Linux 2 2.0.20190618 or later and Ubuntu 20.04 or later comes preconfigured ' +
          'with EC2 Instance Connect). Users will be able to SSH to the linux based instances using the key pairs ' +
          'they create on this platform. They will be able to SSH using EC2 Instance Connect without requiring any ' +
          'static key pairs. ',
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
      // { name: 's3Prefixes', desc: 'A JSON array of S3 prefixes based on the associated studies' },
      { name: 'iamPolicyDocument', desc: 'The IAM policy to be associated with the launched environment workstation' },
      {
        name: 'environmentInstanceFiles',
        desc:
          'An S3 URI (starting with "s3://") that specifies the location of files to be copied to the environment ' +
          'instance, including any bootstrap scripts',
      },
      {
        name: 'uid',
        desc: 'A unique identifier for the user launching the environment',
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
      userService,
      environmentScService,
      environmentScKeypairService,
      indexesService,
      awsAccountsService,
      environmentAmiService,
      envTypeConfigService,
    ] = await this.service([
      'userService',
      'environmentScService',
      'environmentScKeypairService',
      'indexesService',
      'awsAccountsService',
      'environmentAmiService',
      'envTypeConfigService',
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
    // require AMI ids (i.e., all param values that match ami naming pattern )
    const envTypeConfig = await envTypeConfigService.mustFind(requestContext, envTypeId, { id: envTypeConfigId });
    const amiRelatedParams = _.filter(
      envTypeConfig.params,
      // AMI IDs have values similar to "ami-abcd1234" or "ami-aabbccddee1234567"
      p => _.startsWith(p.value, 'ami-'),
    );

    // TODO: Move this later in the workflow after all param expressions
    //  have been resolved
    const amisToShare = _.map(amiRelatedParams, p => p.value);

    if (!_.isEmpty(amisToShare)) {
      // Share AMIs with the target account (process in batches of 5 at a time)
      // if there are more than 5
      await processInBatches(amisToShare, 5, async imageId => {
        return environmentAmiService.ensurePermissions({ imageId, accountId });
      });
    }

    const studies = await environmentScService.getStudies(requestContext, environment);

    const iamPolicyDocument = await this.getEnvRolePolicy(requestContext, {
      environment,
      studies,
      memberAccountId: accountId,
    });

    const s3Mounts = await this.getS3Mounts(requestContext, {
      environment,
      studies,
      memberAccountId: accountId,
    });

    // TODO: If the ami sharing gets moved (because it doesn't contribute to an env var)
    // then move the update local resource policies too.
    // Using the account root provides basically the same level of security because in either
    // case we have to trust that the member account hasn't altered the role's assume role policy to allow other
    // principals assume it
    // if (s3Prefixes.length > 0) {
    //   await environmentMountService.addRoleArnToLocalResourcePolicies(`arn:aws:iam::${accountId}:root`, s3Prefixes);
    // }

    // Check if the environment being launched needs an admin key-pair to be created in the target account
    // If the configuration being used has any parameter that uses the "adminKeyPairName" variable then it means
    // we need to provision that key in the target account and provide the name of the generated key as the
    // "adminKeyPairName" variable
    // Disabling "no-template-curly-in-string" lint rule because we need to compare with the string literal "${adminKeyPairName}"
    // i.e., without any string interpolation
    // eslint-disable-next-line no-template-curly-in-string
    const isAdminKeyPairRequired = !!_.find(envTypeConfig.params, p => p.value === '${adminKeyPairName}');
    let adminKeyPairName = '';
    if (isAdminKeyPairRequired) {
      adminKeyPairName = await environmentScKeypairService.create(requestContext, envId);
    }

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const user = await userService.mustFindUser({ uid: by });
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

      s3Mounts: JSON.stringify(s3Mounts),
      iamPolicyDocument: JSON.stringify(iamPolicyDocument),
      environmentInstanceFiles: this.settings.get(settingKeys.environmentInstanceFiles),
      // s3Prefixes // This variable is no longer relevant it is being removed, the assumption is that
      // this variable has not been used in any of the product templates.

      uid: user.uid,
      username: user.username,
      userNamespace: user.ns,

      adminKeyPairName,
    };
  }

  async getEnvRolePolicy(requestContext, { environment, studies, memberAccountId }) {
    const policyDoc = new StudyPolicy();
    const pluginRegistryService = await this.service('pluginRegistryService');

    const result = await pluginRegistryService.visitPlugins('study-access-strategy', 'provideEnvRolePolicy', {
      payload: {
        requestContext,
        container: this.container,
        environmentScEntity: environment,
        studies,
        policyDoc,
        memberAccountId,
      },
    });

    const doc = _.get(result, 'policyDoc');
    return _.isUndefined(doc) ? {} : doc.toPolicyDoc();
  }

  async getS3Mounts(requestContext, { environment, studies, memberAccountId }) {
    const s3Mounts = [];
    const pluginRegistryService = await this.service('pluginRegistryService');

    const result = await pluginRegistryService.visitPlugins('study-access-strategy', 'provideStudyMount', {
      payload: {
        requestContext,
        container: this.container,
        environmentScEntity: environment,
        studies,
        s3Mounts,
        memberAccountId,
      },
    });

    return _.get(result, 's3Mounts', []);
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
