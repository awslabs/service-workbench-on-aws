---
id: set_account_budget
title: Set AWS Account Budget
sidebar_label: Set AWS Account Budget
---

## Set AWS Account Budget

To set budget for an AWS account, follow these steps:

1. In the portal navigate to the **Accounts** page using the menu on the left.
2. Click on the **AWS Accounts** tab along the top.
3. Click the **Budget Detail** button.
4. Provide Budget Limit, start date and end date (End date needs to be less than a year from start date)
5. Provide notification thresholds and email 
6. Thresholds and email are interdependent, please fill them both to get notification or remove both to turn off notification

Once the budget is set, AWS Budget will be monitoring the actual spent of the corresponding AWS account. Alert will be sent 
to the notification email address when the actual spent breach each of the thresholds. 

Alert will also be sent 7 days prior to budget end date. If notification email is set, budget end date alert will be 
sent to the notification email. if notification email is not set, budget end date alert will be sent to the email address 
the AWS account is registered under. 
