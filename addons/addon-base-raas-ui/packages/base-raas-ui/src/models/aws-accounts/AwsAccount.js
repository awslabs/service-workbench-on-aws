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

import _ from 'lodash';
import { types } from 'mobx-state-tree';
import Budget from './Budget';
import { AwsStackInfo } from './AwsStackInfo';

const states = [
  {
    key: 'CURRENT',
    display: 'Up-to-Date',
    color: 'green',
    tip: 'IAM Role permissions are up-to-date.',
    spinner: false,
  },
  {
    key: 'NEEDS_UPDATE',
    display: 'Needs Update',
    color: 'orange',
    tip: 'This account needs updated IAM Role permissions. Some functionalities may not work until update.',
    spinner: false,
  },
  {
    key: 'NEEDS_ONBOARD',
    display: 'Needs Onboarding',
    color: 'purple',
    tip: 'This account needs to be onboarded to SWB before it can be used.',
    spinner: false,
  },
  {
    key: 'ERRORED',
    display: 'Error',
    color: 'red',
    tip: 'The account encountered an error while checking IAM role permissions.',
    spinner: false,
  },
  {
    key: 'PENDING',
    display: 'Pending',
    color: 'yellow',
    tip: 'The account is being modified. Please wait a moment.',
    spinner: true,
  },
  {
    key: 'UNKNOWN',
    display: 'Unknown',
    color: 'grey',
    tip: 'Something went wrong.',
    spinner: false,
  },
];
// ==================================================================
// AwsAccounts
// ==================================================================
const AwsAccount = types
  .model('AwsAccounts', {
    id: types.identifier,
    rev: types.maybe(types.number),
    name: '',
    description: '',
    accountId: '',
    externalId: '',
    permissionStatus: '',
    cfnStackName: '',
    cfnStackId: '',
    roleArn: '',
    vpcId: '',
    subnetId: '',
    encryptionKeyArn: '',
    onboardStatusRoleArn: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    budget: types.optional(Budget, {}),
    stackInfo: types.optional(AwsStackInfo, {}),
    isAppStreamConfigured: false,
    appStreamStackName: types.maybe(types.string),
    appStreamFleetName: types.maybe(types.string),
    appStreamSecurityGroupId: types.maybe(types.string),
  })
  .actions(self => ({
    setAwsAccounts(rawAwsAccounts) {
      self.id = rawAwsAccounts.id;
      self.rev = rawAwsAccounts.rev || self.rev || 0;
      self.name = rawAwsAccounts.name || self.name || '';
      self.description = rawAwsAccounts.description || self.description;
      self.accountId = rawAwsAccounts.accountId || rawAwsAccounts.accountId;
      self.externalId = rawAwsAccounts.externalId || self.externalId;
      self.permissionStatus = rawAwsAccounts.permissionStatus || self.permissionStatus || 'UNKNOWN';
      self.cfnStackName = rawAwsAccounts.cfnStackName || self.cfnStackName;
      self.cfnStackId = rawAwsAccounts.cfnStackId || self.cfnStackId;
      self.roleArn = rawAwsAccounts.roleArn || self.roleArn;
      self.vpcId = rawAwsAccounts.vpcId || self.vpcId;
      self.subnetId = rawAwsAccounts.subnetId || self.subnetId;
      self.encryptionKeyArn = rawAwsAccounts.encryptionKeyArn || self.encryptionKeyArn;
      self.onboardStatusRoleArn = rawAwsAccounts.onboardStatusRoleArn || self.onboardStatusRoleArn;
      self.createdAt = rawAwsAccounts.createdAt || self.createdAt;
      self.updatedAt = rawAwsAccounts.updatedAt || self.updatedAt;
      self.createdBy = rawAwsAccounts.createdBy || self.createdBy;
      self.updatedBy = rawAwsAccounts.updatedBy || self.updatedBy;
      self.appStreamStackName = rawAwsAccounts.appStreamStackName;
      self.appStreamFleetName = rawAwsAccounts.appStreamFleetName;
      self.appStreamSecurityGroupId = rawAwsAccounts.appStreamSecurityGroupId;
      self.isAppStreamConfigured =
        !_.isUndefined(rawAwsAccounts.appStreamStackName) &&
        !_.isUndefined(rawAwsAccounts.appStreamFleetName) &&
        !_.isUndefined(rawAwsAccounts.appStreamSecurityGroupId);
      self.rev = rawAwsAccounts.rev || 0;

      // Can't use || for needsPermissionUpdate because the value is a Boolean
      // we don't update the other fields because they are being populated by a separate store
    },

    setStackInfo(stackInfo) {
      self.stackInfo.setStackInfo(stackInfo);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
    get permissionStatusDetail() {
      // We need to clone the entry so that we don't impact the existing states object
      const entry = _.cloneDeep(_.find(states, ['key', self.permissionStatus]) || _.find(states, ['key', 'UNKNOWN']));

      return entry;
    },

    get emailCommonSection() {
      const lines = [
        'Dear AWS Account Admin,',
        '',
        `We are attempting to update your onboarded AWS account #${self.accountId} in AWS Service Workbench.`,
        'This update requires administrator access to the AWS Management Console.',
      ];
      lines.push('');
      lines.push(
        'For your convenience, you can follow these steps to configure the account for the requested access:\n',
      );

      return lines;
    },

    get updateStackEmailTemplate() {
      const { accountId, region, stackInfo = {} } = self;
      const { cfnConsoleUrl, updateStackUrl, urlExpiry } = stackInfo;
      const lines = _.slice(self.emailCommonSection);

      lines.push(
        `1 - Log in to the aws console using the correct account. Please ensure that you are using the correct account #${accountId} and region ${region}\n`,
      );
      lines.push(`2 - Go to the AWS CloudFormation console ${cfnConsoleUrl}\n`);
      lines.push(`    You need to visit the AWS CloudFormation console page before you can follow the next link\n`);
      lines.push(`3 - Click on the following link\n`);
      lines.push(`    ${updateStackUrl}\n`);
      lines.push(
        '    The link takes you to the CloudFormation console where you can review the stack information and provision it.\n',
      );
      lines.push(`    Note: the link expires at ${new Date(urlExpiry).toISOString()}`);
      lines.push(`\n\nRegards,\nService Workbench admin`);
      return lines.join('\n');
    },

    get createStackEmailTemplate() {
      const { accountId, region, stackInfo = {} } = self;
      const { createStackUrl, urlExpiry } = stackInfo;
      const lines = _.slice(self.emailCommonSection);

      lines.push(
        `1 - Log in to the aws console using the correct account. Please ensure that you are using the correct account #${accountId} and region ${region}\n`,
      );
      lines.push(`2 - Click on the following link\n`);
      lines.push(`    ${createStackUrl}\n`);
      lines.push(
        '    The link takes you to the CloudFormation console where you can review the stack information and provision it.\n',
      );
      lines.push(`    Note: the link expires at ${new Date(urlExpiry).toISOString()}`);
      lines.push(`\n\nRegards,\nService Workbench admin`);
      return lines.join('\n');
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { AwsAccount };
