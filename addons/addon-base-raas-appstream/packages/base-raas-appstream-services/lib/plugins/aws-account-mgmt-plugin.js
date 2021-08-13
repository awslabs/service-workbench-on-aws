/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const _ = require('lodash');

const settingKeys = {
  isAppStreamEnabled: 'isAppStreamEnabled',
};

/**
 * Returns a list of active non-AppStream environments linked to a given AWS Account ID
 * This check is only performed when the deployment has AppStream enabled,
 * and is triggered if the user attempts to update the AWS account using SWB APIs.
 * A similar check is performed on the UI components (AccountUtils) as well.
 */
async function getActiveNonAppStreamEnvs({ awsAccountId }, { requestContext, container }) {
  const settings = await container.find('settings');
  const isAppStreamEnabled = settings.getBoolean(settingKeys.isAppStreamEnabled);
  if (!isAppStreamEnabled) return [];

  const nonActiveStates = ['FAILED', 'TERMINATED', 'UNKNOWN'];
  const environmentScService = await container.find('environmentScService');
  const indexesService = await container.find('indexesService');

  const indexes = await indexesService.list(requestContext);
  const indexesIdsOfInterest = _.map(
    _.filter(indexes, index => index.awsAccountId === awsAccountId),
    'id',
  );

  const scEnvs = await environmentScService.list(requestContext);
  const retVal = _.filter(
    scEnvs,
    scEnv =>
      _.includes(indexesIdsOfInterest, scEnv.indexId) &&
      !scEnv.isAppStreamConfigured &&
      !_.includes(nonActiveStates, scEnv.status),
  );

  return retVal;
}

const plugin = { getActiveNonAppStreamEnvs };

module.exports = plugin;
