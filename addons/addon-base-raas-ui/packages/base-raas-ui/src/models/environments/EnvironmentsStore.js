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
import { getEnv, types } from 'mobx-state-tree';
import { displayWarning } from '@aws-ee/base-ui/dist/helpers/notification';
import { consolidateToMap, storage } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getEstimatedCost } from '../../helpers/externalCostUtil';
import localStorageKeys from '../constants/local-storage-keys';
import {
  getEnvironments,
  deleteEnvironment,
  createEnvironment,
  getEnvironmentCost,
  getExternalTemplate,
  updateEnvironment,
} from '../../helpers/api';
import { Environment } from './Environment';
import { EnvironmentStore } from './EnvironmentStore';
import CfnService from '../../helpers/cfn-service';
import ExternalKeypairService from '../../helpers/externalKeypairService';
import ExternalVpcService from '../../helpers/externalVpcService';
import getExternalAccountDetails from '../../helpers/externalAccountDetails';

// ==================================================================
// EnvironmentsStore
// ==================================================================
const EnvironmentsStore = BaseStore.named('EnvironmentsStore')
  .props({
    environments: types.optional(types.map(Environment), {}),
    environmentStores: types.optional(types.map(EnvironmentStore), {}),
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const environments = await getEnvironments();

        try {
          const costPromises = environments.map(env => {
            if (env.isExternal) {
              return getEstimatedCost(env, 1);
            }
            return getEnvironmentCost(env.id, 1);
          });

          const costInfo = await Promise.all(costPromises);

          for (let i = 0; i < environments.length; i++) {
            environments[i].costs = costInfo[i];
          }
        } catch (error) {
          displayWarning('Error encountered retrieving cost data', error);
        }

        self.runInAction(() => {
          consolidateToMap(self.environments, environments, (exiting, newItem) => {
            exiting.setEnvironment(newItem);
          });
        });
      },

      addEnvironment(rawEnvironment) {
        const id = rawEnvironment.id;
        const previous = self.environments.get(id);

        if (!previous) {
          self.environments.put(rawEnvironment);
        } else {
          previous.setEnvironment(rawEnvironment);
        }
      },

      getEnvironmentStore: environmentId => {
        let entry = self.environmentStores.get(environmentId);
        if (!entry) {
          // Lazily create the store
          self.environmentStores.set(environmentId, EnvironmentStore.create({ environmentId }));
          entry = self.environmentStores.get(environmentId);
        }

        return entry;
      },

      markAsTerminating: id => {
        const previous = self.environments.get(id);
        if (previous) {
          previous.markAsTerminating();
        }
      },

      async updateExternalEnvironment(environment, user, pin) {
        if (!environment.isExternal || !user.isExternalUser || _.isEmpty(storage.getItem(localStorageKeys.pinToken))) {
          return;
        }
        const creds = await user.unencryptedCreds(pin);
        const cfn = new CfnService(creds.accessKeyId, creds.secretAccessKey, creds.region);
        const request = { id: environment.id };
        try {
          const response = await cfn.describeStack(environment.stackId);
          _.assign(request, this.convertCfnResponse(response, environment.instanceInfo));
        } catch (e) {
          _.assign(request, { status: 'FAILED', error: e.message });
        } finally {
          if (environment.status !== request.status) {
            updateEnvironment(request);
          }
        }
      },

      convertCfnResponse(response, instanceInfo) {
        if (!response.isDone) {
          return { status: 'PENDING' };
        }
        response.outputs.forEach(output => {
          _.assign(instanceInfo, { [output.key]: output.value });
        });
        instanceInfo = _.omitBy(instanceInfo, _.isEmpty);
        return response.isFailed
          ? { status: 'FAILED', error: response.statusReason, instanceInfo }
          : response.status === 'DELETE_COMPLETE'
          ? { status: 'TERMINATED', instanceInfo }
          : { status: 'COMPLETED', instanceInfo };
      },

      async deleteEnvironment(environment, user, pin) {
        if (environment.isExternal) {
          await this.deleteExternalEnvironment(await user.unencryptedCreds(pin), environment);
        }
        const uiEventBus = getEnv(self).uiEventBus;
        await deleteEnvironment(environment.id);
        await uiEventBus.fireEvent('environmentDeleted', environment);
      },

      async deleteExternalEnvironment(creds, environment) {
        const cfn = new CfnService(creds.accessKeyId, creds.secretAccessKey, creds.region);
        await cfn.deleteStack(environment.stackId);

        if (environment.instanceInfo.type !== 'sagemaker') {
          const externalKeypairService = new ExternalKeypairService(creds);
          await externalKeypairService.delete(environment.id);
        }
      },

      async createEnvironment(environment) {
        // environment = { platformId, configurationId, name, description, projectId, studyIds, params, pin }
        // - projectId is only available if the user is not external
        // - pin is only available if creation of the environment is done by an external researcher user role.
        //   and should never be sent to the server
        const user = self.user;
        const result = user.isExternalResearcher
          ? await this.createExternalEnvironment(
              await user.unencryptedCreds(environment.pin),
              user.username,
              _.omit(environment, ['pin']), // remove the pin, we don't want to send it to the server
            )
          : await createEnvironment(environment);
        self.addEnvironment(result);
        return self.getEnvironment(result.id);
      },

      async createExternalEnvironment(creds, username, rawEnvironment) {
        const { platformId, configurationId } = rawEnvironment;
        const configuration = self.getComputeConfiguration(platformId, configurationId);
        const { type, title } = configuration;
        const size = configuration.getParam('size');

        // We need to get the external account details to pass the account Id to the api to allow ami access
        const { Account: accountId } = await getExternalAccountDetails(creds);
        // We first call the backend because it will enrich with id and the imageId if needed
        const environment = await createEnvironment({ ...rawEnvironment, accountId });
        const cfn = new CfnService(creds.accessKeyId, creds.secretAccessKey, creds.region);
        const name = `analysis-${new Date().getTime()}`;
        const params = await this.getExternalParams({ environment, name, creds });
        const url = await getExternalTemplate(`${type}.cfn.yml`);
        const response = await cfn.createStack(
          name,
          params,
          url,
          username,
          `Created By ${username} - ${title} - ${type} - ${size}`,
        );

        return updateEnvironment({ id: environment.id, stackId: response.StackId });
      },

      async getExternalParams({
        environment: {
          id,
          instanceInfo: { type, size, config, cidr, s3Mounts, iamPolicyDocument, environmentInstanceFiles },
          amiImage,
        },
        name,
        creds,
      }) {
        const cfnParams = [];
        const addParam = (key, v) => cfnParams.push({ ParameterKey: key, ParameterValue: `${v}` });

        addParam('Namespace', name);
        addParam('S3Mounts', s3Mounts);
        addParam('IamPolicyDocument', iamPolicyDocument);
        addParam('EnvironmentInstanceFiles', environmentInstanceFiles);

        const externalVpcService = new ExternalVpcService(creds);
        const { vpcId, subnetId } = await externalVpcService.defaultVPCInfo();
        addParam('VPC', vpcId);
        addParam('Subnet', subnetId);

        if (type === 'sagemaker') {
          addParam('InstanceType', size); // Yes, size here is actually the instance type we want to send to cfn
        }

        if (type === 'emr') {
          addParam('DiskSizeGB', config.diskSizeGb.toString());
          addParam('MasterInstanceType', size);
          addParam('WorkerInstanceType', config.workerInstanceSize);
          addParam('CoreNodeCount', config.workerInstanceCount.toString());

          // Add parameters to support spot instance pricing if specified
          // TODO this needs to be parameterized
          const isOnDemand = !config.spotBidPrice;
          // The spot bid price can only have 3 decimal places maximum
          const spotBidPrice = isOnDemand ? '0' : config.spotBidPrice.toFixed(3);

          addParam('Market', isOnDemand ? 'ON_DEMAND' : 'SPOT');
          addParam('WorkerBidPrice', spotBidPrice);

          // These paramaters apply for types apart from sagemaker, but keep the logic simple for now
          const externalKeypairService = new ExternalKeypairService(creds);
          const keyName = await externalKeypairService.create(id);

          addParam('AmiId', amiImage);
          addParam('AccessFromCIDRBlock', cidr);
          addParam('KeyName', keyName);
        }

        return cfnParams;
      },

      async updateEnvironment(environment) {
        await updateEnvironment(environment);
      },

      cleanup: () => {
        storage.removeItem(localStorageKeys.pinToken);
        self.environments.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.environments.size === 0;
    },

    get total() {
      return self.environments.size;
    },

    get list() {
      const result = [];
      self.environments.forEach(environment => result.push(environment));

      return _.reverse(_.sortBy(result, ['createdAt', 'name']));
    },

    getEnvironment(id) {
      return self.environments.get(id);
    },

    get user() {
      return getEnv(self).userStore.user;
    },

    getComputeConfiguration(platformId, configurationId) {
      const store = getEnv(self).computePlatformsStore;
      const platform = store.getComputePlatform(platformId);
      if (!platform) return undefined;
      return platform.getConfiguration(configurationId);
    },
  }));

function registerContextItems(appContext) {
  appContext.environmentsStore = EnvironmentsStore.create({}, appContext);
}

export { EnvironmentsStore, registerContextItems };
