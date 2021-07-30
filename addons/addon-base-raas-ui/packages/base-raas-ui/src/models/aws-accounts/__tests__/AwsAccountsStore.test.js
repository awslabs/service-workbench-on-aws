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

import { getAwsAccounts, addAwsAccount, updateAwsAccount, getAllAccountsPermissionStatus } from '../../../helpers/api';
import { registerContextItems as registerAwsAccountsStore } from '../AwsAccountsStore';

jest.mock('../../../helpers/api');

describe('AwsAccountsStore', () => {
  let store = null;
  const appContext = {};
  const newAwsAccount = {
    id: 'mouserat',
    rev: 5000,
    name: 'candles-in-the-wind',
    description: 'up in horsey heaven, heres the thing',
    accountId: 'you_trade_your_legs_for_angels_wings',
    externalId: 'and-once-weve-all-said-goodbye',
    roleArn: 'YouTakeARunningLeapAndYouLearnToFly',
    vpcId: 'and_although_we_all_miss_you_every_day',
    subnetId: 'we-know-youre-up-there-eating-heavens-hay',
    encryptionKeyArn: 'AndHeresThePartThatHurtsTheMost',
    createdAt: 'humans cannot ride a ghost :(',
    updatedAt: 'Bye bye, Lil Sebastian',
    permissionStatus: 'CURRENT',
    cfnStackName: 'testCfnName',
    cfnStackId: '',
    onboardStatusRoleArn: 'placeholder-arn',
  };
  const permRetVal = { newStatus: { mouserat: 'CURRENT' } };

  beforeEach(async () => {
    await registerAwsAccountsStore(appContext);
    store = appContext.awsAccountsStore;
  });

  describe('addAwsAccount', () => {
    it('should successfully add a new Aws Account without AppStream configured', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([]);
      addAwsAccount.mockResolvedValue(newAwsAccount);
      getAllAccountsPermissionStatus.mockResolvedValue(permRetVal);
      await store.load();

      // OPERATE
      await store.addAwsAccount(newAwsAccount);

      const expectedAwsAccount = {
        ...newAwsAccount,
        isAppStreamConfigured: false,
        appStreamFleetName: undefined,
        appStreamSecurityGroupId: undefined,
        appStreamStackName: undefined,
      };
      delete expectedAwsAccount.createdAt;
      // CHECK
      expect(store.list[0]).toMatchObject(expectedAwsAccount);
    });

    it('should successfully add a new Aws Account with AppStream configured', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([]);
      const appStreamFleetName = 'fleet1';
      const appStreamSecurityGroupId = 'sg1';
      const appStreamStackName = 'stack1';
      const appStreamConfiguredAwsAccount = {
        ...newAwsAccount,
        appStreamFleetName,
        appStreamSecurityGroupId,
        appStreamStackName,
      };
      addAwsAccount.mockResolvedValue(appStreamConfiguredAwsAccount);
      getAllAccountsPermissionStatus.mockResolvedValue(permRetVal);
      await store.load();

      // OPERATE
      await store.addAwsAccount(appStreamConfiguredAwsAccount);

      // CHECK
      const expectedAwsAccount = { ...appStreamConfiguredAwsAccount, isAppStreamConfigured: true };
      delete expectedAwsAccount.createdAt;
      expect(store.list[0]).toMatchObject(expectedAwsAccount);
    });

    it('should not add an Aws Account', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([newAwsAccount]);
      addAwsAccount.mockResolvedValue(newAwsAccount);
      getAllAccountsPermissionStatus.mockResolvedValue(permRetVal);
      await store.load();

      // OPERATE
      await store.addAwsAccount(newAwsAccount);

      // CHECK
      expect(store.list.length).toBe(1);
    });
  });

  describe('filteredList', () => {
    it('should return the whole list if the filter does not exist', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([newAwsAccount]);
      getAllAccountsPermissionStatus.mockResolvedValue(permRetVal);
      await store.load();

      // OPERATE
      const retVal = store.filtered('randomfiltername');

      // CHECK
      expect(retVal).toMatchObject(store.list);
    });
  });

  describe('AWS Account-specific tests', () => {
    it('should generate the email template for a given AWS account', async () => {
      // BUILD
      // getAwsAccounts.mockResolvedValue([newAwsAccount]);
      // getAllAccountsPermissionStatus.mockResolvedValue(permRetVal);
      await store.load();
      await store.addAwsAccount(newAwsAccount);

      // OPERATE
      const account = store.getAwsAccount(newAwsAccount.id);

      const commonSectionChunk = `We are attempting to update your onboarded AWS account #${account.accountId} in AWS Service Workbench.`;
      const createChunk = '2 - Click on the following link';
      const updateChunk = '3 - Click on the following link';

      const createString = account.createStackEmailTemplate;
      const updateString = account.updateStackEmailTemplate;

      expect(createString).toContain(commonSectionChunk);
      expect(createString).toContain(createChunk);
      expect(updateString).toContain(commonSectionChunk);
      expect(updateString).toContain(updateChunk);
    });
  });

  describe('updateAccount', () => {
    it('should try to update the account with updated permissions', async () => {
      const erroredAcct = { id: 'testid', permissionsStatus: 'CURRENT' };
      const newPermRetVal = { newStatus: { testid: 'NEEDS_UPDATE' } };
      getAllAccountsPermissionStatus.mockResolvedValue(newPermRetVal);
      await store.load();
      await store.updateAwsAccount(erroredAcct.id, erroredAcct);

      expect(updateAwsAccount).toHaveBeenCalledWith(erroredAcct.id, erroredAcct);
    });
  });
});
