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
const moment = require('moment');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { isAdmin, isActive } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const createSchema = require('../schema/create-budget');

class BudgetsService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'awsAccountsService', 'jsonSchemaValidationService']);
    this.budgetName = 'service-workbench-system-generated-budget-do-not-update';
  }

  async init() {
    await super.init();
  }

  async get(requestContext, id) {
    this._assertAuthorized(requestContext);
    const { budgetsClient, accountId } = await this._getBudgetClientAndAWSAccountId(requestContext, id);
    return this._getBudget(accountId, budgetsClient);
  }

  async create(requestContext, requestBody) {
    this._assertAuthorized(requestContext);
    await this.validateInput(requestBody);
    const { id, budgetConfiguration } = requestBody;
    const { budgetsClient, accountId } = await this._getBudgetClientAndAWSAccountId(requestContext, id);
    await this._createBudget(accountId, budgetsClient, budgetConfiguration);
    return { message: 'success create' };
  }

  async update(requestContext, requestBody) {
    this._assertAuthorized(requestContext);
    await this.validateInput(requestBody);
    const { id, budgetConfiguration } = requestBody;
    const { budgetsClient, accountId } = await this._getBudgetClientAndAWSAccountId(requestContext, id);
    await this._updateBudget(accountId, budgetsClient, budgetConfiguration);
    return { message: 'success update' };
  }

  async validateInput(requestBody) {
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    await jsonSchemaValidationService.ensureValid(requestBody, createSchema);
    // Check end date is less then a year from start date so the spent amount won't get reset before end of budget
    const diff = moment(requestBody.budgetConfiguration.endDate * 1000).diff(
      requestBody.budgetConfiguration.startDate * 1000,
    );
    if (moment.duration(diff).asYears() >= 1) {
      throw this.boom.badRequest('Input has validation error: End date is more than a year from start date. ', true);
    }
  }

  async _getBudget(accountId, budgetsClient) {
    const requestParams = {
      AccountId: accountId,
      BudgetName: this.budgetName,
    };
    let budgetApiResponse;
    let thresholds;
    let notificationEmail;
    try {
      budgetApiResponse = await budgetsClient.describeBudget(requestParams).promise();
      const budgetApiNotificationResponse = await budgetsClient.describeNotificationsForBudget(requestParams).promise();
      const notifications = budgetApiNotificationResponse.Notifications;
      if (notifications.length !== 0) {
        thresholds = notifications.map(x => x.Threshold);
        // get the notification email of a threshold, Galileo always set the same email for all thresholds
        notificationEmail = await this._getANotificationEmail(requestParams, notifications[0], budgetsClient);
      }
    } catch (e) {
      // If budget was not created before, return empty object
      if (e.code === 'NotFoundException') {
        return {};
      }
      if (e.code === 'AccessDeniedException') {
        throw this.boom.forbidden(
          `AWS member account ${accountId} does not have Budget permission set up, ` +
            `please add permissions budgets:ModifyBudget and budgets:ViewBudget to the system role.`,
          true,
        );
      }
      throw e;
    }
    const response = {
      budgetLimit: budgetApiResponse.Budget.BudgetLimit.Amount,
      startDate: budgetApiResponse.Budget.TimePeriod.Start,
      endDate: budgetApiResponse.Budget.TimePeriod.End,
      thresholds,
      notificationEmail,
    };
    return response;
  }

  async _updateBudget(accountId, budgetsClient, newBudgetConfiguration) {
    let requestParams = {
      AccountId: accountId,
      NewBudget: this._formBudgetObject(newBudgetConfiguration),
    };
    await this._runAndCatchInvalidParameterError(async () => budgetsClient.updateBudget(requestParams).promise());
    // Update thresholds
    requestParams = {
      AccountId: accountId,
      BudgetName: this.budgetName,
    };
    const budgetApiNotificationResponse = await budgetsClient.describeNotificationsForBudget(requestParams).promise();
    const notifications = budgetApiNotificationResponse.Notifications;
    const oldThresholds = notifications.map(x => x.Threshold);
    const newThresholds = _.get(newBudgetConfiguration, 'thresholds', []);
    // Check if thresholds need update
    if (_.isEqual(oldThresholds.sort(), newThresholds.sort())) {
      // Check if there's notifications
      if (notifications.length === 0) {
        return;
      }
      // Check if notification email needs update
      // spot check one email here as Galileo always use the same email for all notification
      // Assume no one is updating the Budget info from AWS console now
      const oldNotificationEmail = this._getANotificationEmail(requestParams, notifications[0], budgetsClient);
      if (oldNotificationEmail === newBudgetConfiguration.notificationEmail) {
        return;
      }
    }
    await this._updateNotificationsNSubscribers(notifications, newBudgetConfiguration, budgetsClient, requestParams);
  }

  async _createBudget(accountId, budgetsClient, newBudgetConfiguration) {
    const requestParams = {
      AccountId: accountId,
      Budget: this._formBudgetObject(newBudgetConfiguration),
      NotificationsWithSubscribers: this._formNotificationObjects(newBudgetConfiguration),
    };
    await this._runAndCatchInvalidParameterError(async () => budgetsClient.createBudget(requestParams).promise());
  }

  async _getANotificationEmail(requestParams, notification, budgetsClient) {
    const budgetApiSubscribersResponse = await budgetsClient
      .describeSubscribersForNotification({ ...requestParams, Notification: notification })
      .promise();
    return budgetApiSubscribersResponse.Subscribers[0].Address;
  }

  async _updateNotificationsNSubscribers(oldNotifications, newBudgetConfiguration, budgetsClient, requestParams) {
    // Delete existing notifications
    const deletePromises = oldNotifications.map(notification =>
      budgetsClient.deleteNotification({ ...requestParams, Notification: notification }).promise(),
    );
    await Promise.all(deletePromises);
    // Add new notifications
    if (_.has(newBudgetConfiguration, 'thresholds')) {
      const newNotifications = this._formNotificationObjects(newBudgetConfiguration);
      const createPromises = newNotifications.map(notification =>
        budgetsClient.createNotification({ ...requestParams, ...notification }).promise(),
      );
      await this._runAndCatchInvalidParameterError(async () => Promise.all(createPromises));
    }
  }

  _formBudgetObject(newBudgetConfig) {
    const budget = {
      BudgetName: this.budgetName,
      BudgetType: 'COST',
      TimeUnit: 'ANNUALLY',
      BudgetLimit: {
        Amount: newBudgetConfig.budgetLimit,
        Unit: 'USD',
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
        End: newBudgetConfig.endDate,
        Start: newBudgetConfig.startDate,
      },
    };
    return budget;
  }

  _formNotificationObjects(newBudgetConfig) {
    const thresholds = _.get(newBudgetConfig, 'thresholds', []);
    return thresholds.map(threshold => {
      return {
        Notification: {
          ComparisonOperator: 'GREATER_THAN',
          NotificationType: 'ACTUAL',
          Threshold: threshold,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [
          {
            Address: newBudgetConfig.notificationEmail,
            SubscriptionType: 'EMAIL',
          },
        ],
      };
    });
  }

  async _getBudgetClientAndAWSAccountId(requestContext, id) {
    const { accessKeyId, secretAccessKey, sessionToken, accountId } = await this._getCredentials(requestContext, id);
    const aws = await this.service('aws');
    const budgetsClient = new aws.sdk.Budgets({
      apiVersion: '2017-10-25',
      region: 'us-east-1',
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });
    return { budgetsClient, accountId };
  }

  _assertAuthorized(requestContext) {
    if (isAdmin(requestContext) && isActive(requestContext)) {
      return;
    }
    throw this.boom.forbidden('You are not authorized to perform this operation', true);
  }

  async _runAndCatchInvalidParameterError(fn) {
    try {
      const response = await fn();
      return response;
    } catch (e) {
      if (e.code === 'InvalidParameterException') {
        throw this.boom.badRequest(`Input has validation error: ${e.message}`, true);
      }
      throw e;
    }
  }

  async _getCredentials(requestContext, awsAccountUUID) {
    const [aws, awsAccountsService] = await this.service(['aws', 'awsAccountsService']);
    const { roleArn, externalId, accountId } = await runAndCatch(
      async () => {
        return awsAccountsService.mustFind(requestContext, { id: awsAccountUUID }); // awsAccountId
      },
      async () => {
        throw this.boom.badRequest(`account with id "${awsAccountUUID}" is not available`);
      },
    );

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const { accessKeyId, secretAccessKey, sessionToken } = await aws.getCredentialsForRole({
      roleArn,
      roleSessionName: `RaaS-${by.username}`,
      externalId,
    });

    return { accessKeyId, secretAccessKey, sessionToken, accountId };
  }
}

module.exports = BudgetsService;
