const _ = require('lodash');
const { CloudFormation } = require('@aws-sdk/client-cloudformation');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const { EC2 } = require('@aws-sdk/client-ec2');
const { STS } = require('@aws-sdk/client-sts');
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const SLEEP_TIME_MS = 1000; // Increase this if throttling occurs with EC2.ModifyVpcEndpoint

/*
This script is meant for TRE environments. It adds pre-existing BYOB bucket permissions to VPC Endpoints.
Prerequisite: Update all Hosting Account CloudFormation stacks with the onboard-account.cfn.yml from SWB v6.1.0 so that all accounts show status Up-To-Date.
Prior to calling this script, assume an IAM role from the Main Account that has the following permissions:
  1. DynamoDB Scan permission on the SWB Studies tables
  2. DynamoDB GetItem permission on the SWB AwsAccounts, Indexes, and Projects tables
  3. STS AssumeRole permission on each Hosting Account's Cross Account Role
Expected args: <stage-regionAbbreviation-solutionName> <mainAccountRegion>
Example: npm run update-vpce-with-existing-byob -- dev-va-sw us-east-1
*/
async function run(args) {
  const stageRegionSolutionName = args[1];
  const mainRegion = args[2];
  const dynamodb = new DynamoDB({
    region: mainRegion
  });
  const sts = new STS();

  var nextPageToken = null;
  const projectStudies = {};
  do {
    const params = {
      TableName: `${stageRegionSolutionName}-Studies`,
      IndexName: 'AccountIdIndex', // Only studies that have Account IDs are BYOB Studies,
      FilterExpression: 'attribute_exists(projectId)'
    }
    if (nextPageToken) {
      params.ExclusiveStartKey = nextPageToken;
    }

    const byob_buckets_response = await dynamodb.scan(params);

    byob_buckets_response.Items.forEach((item) => {
      const unmarshalledItem = unmarshall(item);
      const project = unmarshalledItem.projectId;
      if (projectStudies[project]) {
        projectStudies[project].push(unmarshalledItem);
      } else {
        const studies = [unmarshalledItem];
        projectStudies[project] = studies;
      }
    });

    nextPageToken = byob_buckets_response['LastEvaluatedKey'];
  } while(nextPageToken);

  // Iterating through each project to get the hosting account linked to the project and modifying the VPC Endpoint
  // based on each study.
  for (const projectId of Object.keys(projectStudies)) {
    const projectResponse = await dynamodb.getItem({
      TableName: `${stageRegionSolutionName}-Projects`,
      Key: marshall({'id': projectId})
    });
    const indexId = projectResponse.Item.indexId;
    const indexResponse = await dynamodb.getItem({
      TableName: `${stageRegionSolutionName}-Indexes`,
      Key: {'id': indexId}
    });
    const awsAccountId = indexResponse.Item.awsAccountId;
    const awsAccountResponse = await dynamodb.getItem({
      TableName: `${stageRegionSolutionName}-AwsAccounts`,
      Key: {'id': awsAccountId}
    });
    const awsAccount = unmarshall(awsAccountResponse.Item);

    const assumeRoleResponse = await sts.assumeRole({
      ExternalId: awsAccount.externalId,
      RoleArn: awsAccount.roleArn,
      RoleSessionName: 'UpdateVPCEWithExistingBYOB'
    });
    const assumeRoleCreds = assumeRoleResponse.Credentials;

    const ec2Client = new EC2({
      credentials: {
        accessKeyId: assumeRoleCreds.AccessKeyId,
        secretAccessKey: assumeRoleCreds.SecretAccessKey,
        sessionToken: assumeRoleCreds.SessionToken,
      },
      region: mainRegion
    });

    for (const studyEntity of projectStudies[projectId]) {
      // Dynamically add the BYOB bucket account to the KMS VPCE Policy
      const { accountId, region } = studyEntity;

      // Note that unlike the service code, kms VPCe will be updated regardless of SSE KMS Encryption
      // due to lacking the role allocation for the BYOB study
      const kmsVpceId = await getVpceIdFromAccount(awsAccount, 'KMS', sts);
      if (kmsVpceId === null) {
        return; // Skipping this study because the associated HostingAccount stack could not be found
      }
      console.log(`Updating KMS VPCE Policy to include ${accountId}`);
      await addAccountToKmsVpcePolicy(ec2Client, accountId, kmsVpceId, region, 'BYOB Account Keys');

      // Dynamically add the BYOB fs role to the STS VPCE Policy
      const stsVpceId = await getVpceIdFromAccount(awsAccount, 'STS', sts);
      const roleArn = `arn:aws:iam::${accountId}:role/swb-*-fs-*`;
      console.log(`Updating STS VPCE Policy to include ${accountId}`);
      await addRoleToStsVpcePolicy(ec2Client, roleArn, stsVpceId, 'AllowAssumeRole');

      sleep(SLEEP_TIME_MS); // Adding sleep to avoid throttling with EC2.ModifyVpcEndpoint
    }
  }
}

async function addAccountToKmsVpcePolicy(ec2Client, awsAccountId, vpceId, region, sidToReplace) {
  // Get VPCE Policy
  const vpcePolicy = await getVpcePolicy(ec2Client, vpceId);
  // check if Statement for Sid exists
  const sidStatement = vpcePolicy.Statement.find(statement => statement.Sid === sidToReplace);
  if (!sidStatement) {
    // create Statement
    const statement = {
      Sid: sidToReplace,
      Effect: 'Allow',
      Principal: '*',
      Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
      Resource: [`arn:aws:kms:${region}:${awsAccountId}:key/*`],
    };
    // add Statement to VPCE Policy
    vpcePolicy.Statement.push(statement);
    // save new policy to VPCE
    await ec2Client
      .modifyVpcEndpoint({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(vpcePolicy),
      });
  }
  // get resource list
  const resourceList = sidStatement.Resource;
  // check if resource list already contains account
  const accountResource = resourceList.find(resource => resource === `arn:aws:kms:${region}:${awsAccountId}:key/*`);
  if (!accountResource) {
    // add account to Resource list
    resourceList.push(`arn:aws:kms:${region}:${awsAccountId}:key/*`);
    sidStatement.Resource = resourceList;
    // replace Statement in VPCE Policy
    vpcePolicy.Statement = vpcePolicy.Statement.map(statement =>
      statement.Sid === sidToReplace ? sidStatement : statement,
    );
    // save updated policy to VPCE
    await ec2Client
      .modifyVpcEndpoint({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(vpcePolicy),
      });
  }
}

async function addRoleToStsVpcePolicy(ec2Client, roleArn, vpceId, sidToReplace) {
  // Get VPCE Policy
  const vpcePolicy = await getVpcePolicy(ec2Client, vpceId);
  // Check if Statement for Sid exists
  const sidStatement = vpcePolicy.Statement.find(statement => statement.Sid === sidToReplace);
  if (!sidStatement) {
    // create Statement
    const statement = {
      Sid: sidToReplace,
      Effect: 'Allow',
      Principal: '*',
      Action: ['sts:AssumeRole'],
      Resource: [roleArn],
    };
    // add Statement to VPCE Policy
    vpcePolicy.Statement.push(statement);
    // save new policy to VPCE
    await ec2Client
      .modifyVpcEndpoint({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(vpcePolicy),
      });
  }
  // get resource list
  const resourceList = sidStatement.Resource;
  // check if resource list already contains role
  const accountResource = resourceList.find(resource => resource === roleArn);
  if (!accountResource) {
    // add role to Resource list
    resourceList.push(roleArn);
    sidStatement.Resource = resourceList;
    // replace Statement in VPCE Policy
    vpcePolicy.Statement = vpcePolicy.Statement.map(statement =>
      statement.Sid === sidToReplace ? sidStatement : statement,
    );
    // save updated policy to VPCE
    await ec2Client
      .modifyVpcEndpoint({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(vpcePolicy),
      });
  }
}

async function getVpcePolicy(ec2Client, vpceId) {
  const vpces = await ec2Client.describeVpcEndpoints({});
  const vpcePolicy = vpces.VpcEndpoints.find(vpcEndpoint => vpcEndpoint.VpcEndpointId === vpceId).PolicyDocument;
  return JSON.parse(vpcePolicy);
}

async function getVpceIdFromAccount(accEntity, vpceServiceName, sts) {
  if (vpceServiceName === 'KMS') {
    return getServiceVpcEndpointId(accEntity, 'KMSVPCE', sts);
  }
  if (vpceServiceName === 'STS') {
    return getServiceVpcEndpointId(accEntity, 'STSVPCE', sts);
  }
  throw new Error('VPCE Service Name not supported');
}

async function getServiceVpcEndpointId(accountEntity, endpointIdOutputName, sts) {
  const { onboardStatusRoleArn, cfnStackId, cfnStackName, externalId } = accountEntity;
  // cfnStackId is a cloudformation stack arn so region is always 4th
  // i.e. arn:aws:cloudformation:<region>:<accountId>:stack/...
  const hostingAccountRegion = cfnStackId.split(':')[3];

  const assumeRoleResponse = await sts.assumeRole({
    ExternalId: externalId,
    RoleArn: onboardStatusRoleArn,
    RoleSessionName: 'UpdateVPCEWithExistingBYOB'
  });
  const assumeRoleCreds = assumeRoleResponse.Credentials;
  const cloudformation = new CloudFormation({
    credentials: {
      accessKeyId: assumeRoleCreds.AccessKeyId,
      secretAccessKey: assumeRoleCreds.SecretAccessKey,
      sessionToken: assumeRoleCreds.SessionToken,
    },
    region: hostingAccountRegion
  });

  const params = { StackName: cfnStackName };
  const stacks = await cloudformation.describeStacks(params);
  const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

  if (_.isEmpty(stack)) {
    // Not throwing error because we do not want to prevent the remaining studies to be processed
    console.error(`Stack '${cfnStackName}' not found. Unable to update hosting account VPC Endpoints.`);
    return null; // Returning null so that script can skip the study associated with this project/hosting account
  }

  return findOutputValue(stack, endpointIdOutputName);
}

const findOutputValue = (stack, prop) => {
  const output = _.find(_.get(stack, 'Outputs', []), item => item.OutputKey === prop);
  return output.OutputValue;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const runCodeAsScript = () => {
  run(process.argv)
};

module.exports = {
  runCodeAsScript,
};
