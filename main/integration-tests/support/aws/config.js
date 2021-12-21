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

const regionShortNamesMap = {
  'us-east-2': 'oh',
  'us-east-1': 'va',
  'us-west-1': 'ca',
  'us-west-2': 'or',
  'ap-east-1': 'hk',
  'ap-south-1': 'mum',
  'ap-northeast-3': 'osa',
  'ap-northeast-2': 'sel',
  'ap-southeast-1': 'sg',
  'ap-southeast-2': 'syd',
  'ap-northeast-1': 'ty',
  'ca-central-1': 'ca',
  'cn-north-1': 'cn',
  'cn-northwest-1': 'nx',
  'eu-central-1': 'fr',
  'eu-west-1': 'irl',
  'eu-west-2': 'ldn',
  'eu-west-3': 'par',
  'eu-north-1': 'sth',
  'me-south-1': 'bhr',
  'sa-east-1': 'sao',
  'us-gov-east-1': 'gce',
  'us-gov-west-1': 'gcw',
};

const config = async ({ settings }) => {
  const awsAccountId = settings.optional('awsAccountId');
  const envName = settings.get('envName');
  const awsRegion = settings.get('awsRegion');
  const solutionName = settings.get('solutionName');
  const awsRegionShortName = regionShortNamesMap[awsRegion];
  const namespace = `${envName}-${awsRegionShortName}-${solutionName}`;
  const globalNamespace = `${awsAccountId}-${namespace}`;

  return {
    awsRegionShortName,
    namespace,
    globalNamespace,
    backendStackName: `${envName}-${awsRegionShortName}-${solutionName}-backend`,
    dbPrefix: namespace,
    studyDataBucketName: `${globalNamespace}-studydata`,
    environmentsBootstrapBucketName: `${globalNamespace}-environments-bootstrap-scripts`,
  };
};

const initConfig = async ({ settings }) => {
  // Future: allow components to contribute configuration values via an extension point
  return config({ settings });
};

module.exports = { initConfig };
