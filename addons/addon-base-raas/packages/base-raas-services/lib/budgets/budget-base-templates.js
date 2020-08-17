// See page https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Budgets.html#updateBudget-property for details on parameters
const budgetTemplate = {
  /* required */
  BudgetName: 'STRING_VALUE' /* required */,
  BudgetType: 'COST' /* required */,
  TimeUnit: 'ANNUALLY' /* required */,
  BudgetLimit: {
    Amount: 'STRING_VALUE' /* required */,
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
    End: new Date(),
    Start: new Date(),
  },
};

const notificationTemplate = {
  Notification: {
    /* required */
    ComparisonOperator: 'GREATER_THAN' /* required */,
    NotificationType: 'ACTUAL' /* required */,
    Threshold: 'NUMBER_VALUE' /* required */,
    ThresholdType: 'PERCENTAGE',
  },
  Subscribers: [
    /* required */
    {
      Address: 'STRING_VALUE' /* required */,
      SubscriptionType: 'EMAIL' /* required */,
    },
    /* more items */
  ],
};

const budgetBaseTemplates = {
  BudgetTemplate: budgetTemplate,
  NotificationTemplate: notificationTemplate,
};

module.exports = budgetBaseTemplates;
