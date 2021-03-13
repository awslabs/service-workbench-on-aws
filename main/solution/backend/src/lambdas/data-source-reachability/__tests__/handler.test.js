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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const DataSourceReachabilityService = require('@aws-ee/base-raas-services/lib/data-source/data-source-reachability-service');
const StudyService = require('@aws-ee/base-raas-services/lib/study/study-service');
const DataSourceAccountService = require('@aws-ee/base-raas-services/lib/data-source/data-source-account-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-raas-services/lib/data-source/data-source-reachability-service');
jest.mock('@aws-ee/base-raas-services/lib/study/study-service');
jest.mock('@aws-ee/base-raas-services/lib/data-source/data-source-account-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');

const { handlerWithContainer } = require('../handler');

describe('handler', () => {
  let dataSourceReachabilityService;
  let studyService;
  let dataSourceAccountService;
  let container;

  beforeEach(async () => {
    container = new ServicesContainer();
    container.register('settings', new SettingsService());
    container.register('dataSourceReachabilityService', new DataSourceReachabilityService());
    container.register('studyService', new StudyService());
    container.register('dataSourceAccountService', new DataSourceAccountService());
    container.register('log', new Logger());
    await container.initServices();

    dataSourceReachabilityService = await container.find('dataSourceReachabilityService');
    dataSourceAccountService = await container.find('dataSourceAccountService');
    studyService = await container.find('studyService');
  });

  it('calls the correct number of times for checking DS Account/Study reachability', async () => {
    // BUILD
    dataSourceReachabilityService.attemptReach = jest.fn(() => Promise.resolve({}));
    // StudyEntity would have the 'status' field for reachable accounts, unlike DbEntity
    studyService.listStudiesForAccount = jest.fn(() =>
      Promise.resolve([
        { id: 'study1', status: 'pending' },
        { id: 'study2', status: 'pending' },
        { id: 'study3', status: 'error' },
        { id: 'study4', status: 'reachable' },
      ]),
    );
    // DsAccountEntity would have the 'status' field for reachable accounts, unlike DbEntity
    dataSourceAccountService.list = jest.fn(() =>
      Promise.resolve([
        { id: 'DsAccount1', status: 'pending' },
        { id: 'DsAccount2', status: 'reachable' },
      ]),
    );

    // EXECUTE
    await handlerWithContainer(container);

    // CHECK
    // Called 2 times to bulk check DS Account reachability of those in pending/error states
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledTimes(5);
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: '*', status: 'pending' },
    );
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: '*', status: 'error' },
    );

    // Called 3 times for each unreachable DS Studies of existing reachable DS Accounts
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: 'study1', type: 'study' },
    );
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: 'study2', type: 'study' },
    );
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: 'study3', type: 'study' },
    );
    expect(dataSourceReachabilityService.attemptReach).not.toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: 'study4', type: 'study' },
    );
  });

  it('only calls for reachability check in bulk for unreachable DS Accounts', async () => {
    // BUILD
    dataSourceReachabilityService.attemptReach = jest.fn(() => Promise.resolve({}));
    // DsAccountEntity would have the 'status' field for reachable accounts, unlike DbEntity
    dataSourceAccountService.list = jest.fn(() =>
      Promise.resolve([
        { id: 'DsAccount1', status: 'pending' },
        { id: 'DsAccount2', status: 'error' },
      ]),
    );

    // EXECUTE
    await handlerWithContainer(container);

    // CHECK
    // Called 2 times to bulk check DS Account reachability of those in pending/error states
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledTimes(2);
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: '*', status: 'pending' },
    );
    expect(dataSourceReachabilityService.attemptReach).toHaveBeenCalledWith(
      {
        actions: [],
        attr: {},
        authenticated: true,
        principal: {
          isAdmin: true,
          ns: 'internal',
          status: 'active',
          uid: '_system_',
          userRole: 'admin',
          username: '_system_',
        },
        principalIdentifier: { uid: '_system_' },
        resources: [],
      },
      { id: '*', status: 'error' },
    );
  });
});
