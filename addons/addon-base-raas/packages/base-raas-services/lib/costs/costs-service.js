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
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { allowIfHasRole } = require('../user/helpers/user-authz-utils');

class CostsService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'awsAccountsService',
      'environmentService',
      'indexesService',
      'costApiCacheService',
      'authorizationService',
    ]);
  }

  async init() {
    await super.init();
  }

  async getIndividualEnvironmentOrProjCost(requestContext, query) {
    // ensure that the caller has permissions to read the cost
    // Perform default condition checks to make sure the user is active and has allowed roles
    const allowIfHasCorrectRoles = (reqContext, { action }) =>
      allowIfHasRole(reqContext, { action, resource: 'environment-or-project-cost' }, ['admin', 'researcher']);
    await this.assertAuthorized(
      requestContext,
      { action: 'read', conditions: [allowIfActive, allowIfHasCorrectRoles] },
      query,
    );

    const { env, proj, groupByUser, groupByEnv, groupByService, numberOfDaysInPast } = query;
    const [environmentService, costApiCacheService] = await this.service(['environmentService', 'costApiCacheService']);

    if (groupByUser === 'true' && groupByEnv === 'true' && groupByService === 'true') {
      return 'Can not groupByUser, groupByEnv, and groupByService. Please pick at most 2 out of the 3.';
    }
    let indexId = '';

    if (proj) {
      indexId = proj;
    } else {
      // The following will only succeed if the user has permissions to access the specified environment
      const result = await environmentService.mustFind(requestContext, { id: env });
      indexId = result.indexId;
    }

    const cacheResponse = await costApiCacheService.find(requestContext, { indexId, query: JSON.stringify(query) });
    if (cacheResponse) {
      const updatedAt = new Date(cacheResponse.updatedAt);
      const now = new Date();
      const elapsedHours = (now - updatedAt) / 1000 / 60 / 60;
      if (elapsedHours < 12) {
        return JSON.parse(cacheResponse.result);
      }
    }

    let filter = {};
    if (proj) {
      filter = {
        Tags: {
          Key: 'Proj',
          Values: [proj],
        },
      };
    } else {
      filter = {
        Tags: {
          Key: 'Env',
          Values: [env],
        },
      };
    }

    const groupBy = [];
    if (groupByService === 'true') {
      groupBy.push({
        Type: 'DIMENSION',
        Key: 'SERVICE',
      });
    }
    if (groupByUser === 'true') {
      groupBy.push({
        Type: 'TAG',
        Key: 'CreatedBy',
      });
    }
    if (groupByEnv === 'true') {
      groupBy.push({
        Type: 'TAG',
        Key: 'Env',
      });
    }

    const response = await this.callAwsCostExplorerApi(requestContext, indexId, numberOfDaysInPast, filter, groupBy);

    const rawCacheData = {
      indexId,
      query: JSON.stringify(query),
      result: JSON.stringify(response),
    };
    costApiCacheService.create(requestContext, rawCacheData);

    return response;
  }

  async callAwsCostExplorerApi(requestContext, indexId, numberOfDaysInPast, filter, groupBy) {
    const [aws] = await this.service(['aws']);
    const { accessKeyId, secretAccessKey, sessionToken } = await this.getCredentials(requestContext, indexId);

    const costExplorer = new aws.sdk.CostExplorer({
      apiVersion: '2017-10-25',
      region: 'us-east-1',
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - numberOfDaysInPast);

    const result = await costExplorer
      .getCostAndUsage({
        TimePeriod: {
          Start: startDate.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0],
        },
        Granularity: 'DAILY',
        Metrics: ['BlendedCost'],
        Filter: filter,
        GroupBy: groupBy,
      })
      .promise();

    const response = result.ResultsByTime.map(item => {
      const costItems = {};
      item.Groups.forEach(group => {
        if (group.Metrics.BlendedCost.Amount > 0) {
          costItems[group.Keys] = {
            amount: Math.round(group.Metrics.BlendedCost.Amount * 100) / 100,
            unit: group.Metrics.BlendedCost.Unit,
          };
        }
      });
      return {
        startDate: item.TimePeriod.Start,
        cost: costItems,
      };
    });

    return response;
  }

  async getCredentials(requestContext, indexId) {
    const [aws, awsAccountsService, indexesService] = await this.service([
      'aws',
      'awsAccountsService',
      'indexesService',
    ]);
    const { roleArn: RoleArn, externalId: ExternalId } = await runAndCatch(
      async () => {
        const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });

        return awsAccountsService.mustFind(requestContext, { id: awsAccountId });
      },
      async () => {
        throw this.boom.badRequest(`account with id "${indexId} is not available`);
      },
    );

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const sts = new aws.sdk.STS({ region: 'us-east-1' });
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await sts
      .assumeRole({
        RoleArn,
        RoleSessionName: `RaaS-${by.username}`,
        ExternalId,
      })
      .promise();

    return { accessKeyId, secretAccessKey, sessionToken };
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'cost-authz', action, conditions },
      ...args,
    );
  }
}

module.exports = CostsService;
