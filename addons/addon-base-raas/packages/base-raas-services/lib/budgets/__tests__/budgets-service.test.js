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
const sinon = require('sinon');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const AWSMock = require('aws-sdk-mock');

// Mocked dependencies
jest.mock('../../aws-accounts/aws-accounts-service');
const AWSAccountsServiceMock = require('../../aws-accounts/aws-accounts-service');

const BudgetsService = require('../budgets-service');

describe('BudgetsService', () => {
  let service;
  const AMOUNT = '500.0';
  const START = '2020-02-28T13:00:00.000Z';
  const END = '2021-02-20T13:00:00.000Z';
  const requestContext = {
    principal: {
      isAdmin: true,
      status: 'active',
    },
  };

  const requestBody = {
    budgetConfiguration: {
      budgetLimit: '1000.0',
      startDate: 1598400000,
      endDate: 1608854400,
      thresholds: [50, 90, 100],
      notificationEmail: 'test@example.com',
    },
    id: 'aws-account-uuid-from-ddb',
  };

  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('awsAccountsService', new AWSAccountsServiceMock());
    container.register('aws', new Aws());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('budgetsService', new BudgetsService());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('budgetsService');

    const mockCredentials = {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken',
      accountId: 'accountId',
    };
    service._getCredentials = jest.fn(() => mockCredentials);
  });

  beforeEach(async () => {
    const aws = await service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('get', () => {
    it('should return budget when get', async () => {
      // BUILD
      const budgetAPIResponse = {
        Budget: {
          BudgetLimit: {
            Amount: AMOUNT,
          },
          TimePeriod: {
            Start: START,
            End: END,
          },
        },
      };

      const notificationsAPIResponse = {
        Notifications: [
          { Threshold: 50, ComparisonOperator: 'GREATER_THAN', NotificationType: 'ACTUAL' },
          { Threshold: 70, ComparisonOperator: 'GREATER_THAN', NotificationType: 'ACTUAL' },
        ],
      };

      const subscribersAPIResponse = { Subscribers: [{ Address: 'test@example.com' }] };

      AWSMock.mock('Budgets', 'describeBudget', budgetAPIResponse);
      AWSMock.mock('Budgets', 'describeNotificationsForBudget', notificationsAPIResponse);
      AWSMock.mock('Budgets', 'describeSubscribersForNotification', subscribersAPIResponse);

      // OPERATE
      const response = await service.get(requestContext, '12345678');

      // CHECK
      expect(response).toMatchObject({
        budgetLimit: AMOUNT,
        startDate: START,
        endDate: END,
        thresholds: [50, 70],
        notificationEmail: 'test@example.com',
      });
    });

    it('should throw forbidden if user is not active admin', async () => {
      await expect(service.get({}, '12345678')).rejects.toThrow('You are not authorized to perform this operation');
    });

    it('should return empty object when API throws NotFoundException', async () => {
      // BUILD
      AWSMock.mock('Budgets', 'describeBudget', (params, callback) => {
        callback({ code: 'NotFoundException' }, null);
      });

      // OPERATE
      const response = await service.get(requestContext, '12345678');

      // CHECK
      expect(response).toMatchObject({});
    });

    it('should throw error with explanation if API throws AccessDeniedException', async () => {
      // BUILD
      AWSMock.mock('Budgets', 'describeBudget', (params, callback) => {
        const error = {
          code: 'AccessDeniedException',
        };
        callback(error, null);
      });

      // OPERATE and CHECK
      await expect(service.get(requestContext, '12345678')).rejects.toThrow(
        'AWS member account accountId does not have Budget permission set up, ' +
          'please add permissions budgets:ModifyBudget and budgets:ViewBudget to the system role.',
      );
    });
  });

  describe('create', () => {
    it('should return success message when create', async () => {
      // BUILD
      const expectedAPIRequestBody = {
        AccountId: 'accountId',
        Budget: {
          /* required */
          BudgetName: 'service-workbench-system-generated-budget-do-not-update' /* required */,
          BudgetType: 'COST' /* required */,
          TimeUnit: 'ANNUALLY' /* required */,
          BudgetLimit: {
            Amount: '1000.0' /* required */,
            Unit: 'USD' /* required */,
          },
          CostTypes: {
            IncludeCredit: true,
            IncludeDiscount: true,
            IncludeOtherSubscription: true,
            IncludeRecurring: true,
            IncludeRefund: true,
            IncludeSubscription: true,
            IncludeSupport: true,
            IncludeTax: true,
            IncludeUpfront: true,
            UseAmortized: true,
            UseBlended: false,
          },
          TimePeriod: {
            End: 1608854400,
            Start: 1598400000,
          },
        },
        NotificationsWithSubscribers: [
          {
            Notification: {
              ComparisonOperator: 'GREATER_THAN',
              NotificationType: 'ACTUAL',
              Threshold: 50,
              ThresholdType: 'PERCENTAGE',
            },
            Subscribers: [
              {
                Address: 'test@example.com',
                SubscriptionType: 'EMAIL',
              },
            ],
          },
          {
            Notification: {
              ComparisonOperator: 'GREATER_THAN',
              NotificationType: 'ACTUAL',
              Threshold: 90,
              ThresholdType: 'PERCENTAGE',
            },
            Subscribers: [
              {
                Address: 'test@example.com',
                SubscriptionType: 'EMAIL',
              },
            ],
          },
          {
            Notification: {
              ComparisonOperator: 'GREATER_THAN',
              NotificationType: 'ACTUAL',
              Threshold: 100,
              ThresholdType: 'PERCENTAGE',
            },
            Subscribers: [
              {
                Address: 'test@example.com',
                SubscriptionType: 'EMAIL',
              },
            ],
          },
        ],
      };

      AWSMock.mock('Budgets', 'createBudget', (params, callback) => {
        expect(params).toMatchObject(expectedAPIRequestBody);
        callback(null, {});
      });

      // OPERATE
      const response = await service.create(requestContext, requestBody);

      // CHECK
      expect(response).toMatchObject({ message: 'success create' });
    });

    it('should throw validation error when end date is more than a year from start date', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.budgetConfiguration.endDate = 1708854400;

      // OPERATE and CHECK
      await expect(service.create(requestContext, requestBodyCopy)).rejects.toThrow(
        'Input has validation error: End date is more than a year from start date.',
      );
    });

    it('should fail id invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.id = 'invalid##';

      // OPERATE and CHECK
      await expect(service.create(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail budgetLimit invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.budgetConfiguration.budgetLimit = 'invalid##';

      // OPERATE and CHECK
      await expect(service.create(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail description invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.description = '<hack>';

      // OPERATE and CHECK
      await expect(service.create(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail notificationEmail invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.notificationEmail = '<hack>';

      // OPERATE and CHECK
      await expect(service.create(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should throw validation error when Budget API create method throw validation error', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.budgetConfiguration.endDate = 1408854400;

      AWSMock.mock('Budgets', 'createBudget', (params, callback) => {
        callback({ code: 'InvalidParameterException', message: 'End date is before start date' }, null);
      });

      // OPERATE and CHECK
      await expect(service.create(requestContext, requestBodyCopy)).rejects.toThrow(
        'Input has validation error: End date is before start date',
      );
    });
  });

  describe('update', () => {
    const expectedAPIRequestBody = {
      AccountId: 'accountId',
      NewBudget: {
        /* required */
        BudgetName: 'service-workbench-system-generated-budget-do-not-update' /* required */,
        BudgetType: 'COST' /* required */,
        TimeUnit: 'ANNUALLY' /* required */,
        BudgetLimit: {
          Amount: '1000.0' /* required */,
          Unit: 'USD' /* required */,
        },
        CostTypes: {
          IncludeCredit: true,
          IncludeDiscount: true,
          IncludeOtherSubscription: true,
          IncludeRecurring: true,
          IncludeRefund: true,
          IncludeSubscription: true,
          IncludeSupport: true,
          IncludeTax: true,
          IncludeUpfront: true,
          UseAmortized: true,
          UseBlended: false,
        },
        TimePeriod: {
          End: 1608854400,
          Start: 1598400000,
        },
      },
    };

    const notificationResponse = {
      Notifications: [
        {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 80,
          ThresholdType: 'PERCENTAGE',
        },
        {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 100,
          ThresholdType: 'PERCENTAGE',
        },
      ],
    };

    const subscriberResponse = {
      Subscribers: [{ Address: 'test@example.com' }],
    };

    it('should return success message when update', async () => {
      // BUILD
      AWSMock.mock('Budgets', 'updateBudget', (params, callback) => {
        expect(params).toMatchObject(expectedAPIRequestBody);
        callback(null, {});
      });

      AWSMock.mock('Budgets', 'describeNotificationsForBudget', notificationResponse);

      AWSMock.mock('Budgets', 'describeSubscribersForNotification', subscriberResponse);

      const deleteNotificationSpy = sinon.spy();
      AWSMock.mock('Budgets', 'deleteNotification', (params, callback) => {
        deleteNotificationSpy(params);
        callback(null, {});
      });

      const createNotificationSpy = sinon.spy();
      AWSMock.mock('Budgets', 'createNotification', (params, callback) => {
        createNotificationSpy(params);
        callback(null, {});
      });

      // OPERATE
      const response = await service.update(requestContext, requestBody);

      // CHECK
      expect(response).toMatchObject({ message: 'success update' });

      expect(deleteNotificationSpy.getCall(0).args[0]).toMatchObject({
        AccountId: 'accountId',
        BudgetName: 'service-workbench-system-generated-budget-do-not-update',
        Notification: {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 80,
          ThresholdType: 'PERCENTAGE',
        },
      });
      expect(deleteNotificationSpy.getCall(1).args[0]).toMatchObject({
        AccountId: 'accountId',
        BudgetName: 'service-workbench-system-generated-budget-do-not-update',
        Notification: {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 100,
          ThresholdType: 'PERCENTAGE',
        },
      });

      expect(createNotificationSpy.getCall(0).args[0]).toMatchObject({
        AccountId: 'accountId',
        BudgetName: 'service-workbench-system-generated-budget-do-not-update',
        Notification: {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 100,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [
          {
            Address: 'test@example.com',
            SubscriptionType: 'EMAIL',
          },
        ],
      });

      expect(createNotificationSpy.getCall(1).args[0]).toMatchObject({
        AccountId: 'accountId',
        BudgetName: 'service-workbench-system-generated-budget-do-not-update',
        Notification: {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 50,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [
          {
            Address: 'test@example.com',
            SubscriptionType: 'EMAIL',
          },
        ],
      });

      expect(createNotificationSpy.getCall(2).args[0]).toMatchObject({
        AccountId: 'accountId',
        BudgetName: 'service-workbench-system-generated-budget-do-not-update',
        Notification: {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: 90,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [
          {
            Address: 'test@example.com',
            SubscriptionType: 'EMAIL',
          },
        ],
      });
    });

    it('should fail id invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.id = 'invalid##';

      // OPERATE and CHECK
      await expect(service.update(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail budgetLimit invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.budgetConfiguration.budgetLimit = 'invalid##';

      // OPERATE and CHECK
      await expect(service.update(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail description invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.description = '<hack>';

      // OPERATE and CHECK
      await expect(service.update(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail notificationEmail invalid', async () => {
      // BUILD
      const requestBodyCopy = _.cloneDeep(requestBody);
      requestBodyCopy.notificationEmail = '<hack>';

      // OPERATE and CHECK
      await expect(service.update(requestContext, requestBodyCopy)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should throw validation error when Budget API add notification method throw validation error', async () => {
      // BUILD
      AWSMock.mock('Budgets', 'updateBudget', (params, callback) => {
        expect(params).toMatchObject(expectedAPIRequestBody);
        callback(null, {});
      });
      AWSMock.mock('Budgets', 'describeNotificationsForBudget', notificationResponse);
      AWSMock.mock('Budgets', 'describeSubscribersForNotification', subscriberResponse);
      AWSMock.mock('Budgets', 'deleteNotification', {});
      AWSMock.mock('Budgets', 'createNotification', (params, callback) => {
        callback({ code: 'InvalidParameterException', message: 'Email address is not valid' }, null);
      });

      // OPERATE and CHECK
      await expect(service.update(requestContext, requestBody)).rejects.toThrow('Email address is not valid');
    });
  });
});
