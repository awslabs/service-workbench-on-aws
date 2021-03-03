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
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { registerServices } = require('@aws-ee/base-services/lib/utils/services-registration-util');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

const pluginRegistry = require('./plugins/plugin-registry');

const handler = async () => {
  const container = new ServicesContainer(['settings', 'log']);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);
  await container.initServices();
  await handlerWithContainer(container);
};

const handlerWithContainer = async container => {
  const dataSourceReachabilityService = await container.find('dataSourceReachabilityService');
  const studyService = await container.find('studyService');
  const dataSourceAccountService = await container.find('dataSourceAccountService');
  const userContext = getSystemRequestContext();

  // Check reachability of all Data Source Accounts ONLY in unreachable states
  // This kicks off reachability check workflows for all its associated DS studies only if the DS Account status changes
  await dataSourceReachabilityService.attemptReach(userContext, { id: '*', status: 'pending' });
  await dataSourceReachabilityService.attemptReach(userContext, { id: '*', status: 'error' });

  // Check reachability of all Data Source Studies ONLY in unreachable states
  // This checks reachability for newly added DS studies to an already available DS account
  const dsAccounts = await dataSourceAccountService.list(userContext);
  const reachableDsAccounts = _.filter(dsAccounts, dsAccount => dsAccount.status === 'reachable');

  await Promise.all(
    _.map(reachableDsAccounts, async dsAccount => {
      const studies = await studyService.listStudiesForAccount(userContext, { accountId: dsAccount.id });
      const studiesToCheck = _.filter(studies, study => study.status && _.includes(['pending', 'error'], study.status));

      const processor = async study => {
        await dataSourceReachabilityService.attemptReach(userContext, { id: study.id, type: 'study' });
      };

      // Reach out 10 at a time
      await processInBatches(studiesToCheck, 10, processor);
    }),
  );
};

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = handler;
module.exports.handlerWithContainer = handlerWithContainer;
