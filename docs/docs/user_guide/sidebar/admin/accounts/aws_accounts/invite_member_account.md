---
id: invite_member_account
title: Invite an AWS Member Account
sidebar_label: Invite an AWS Member Account
---

As well as [**Creating a Member Account**](create_member_account), you can also invite an AWS Account to the solution. The AWS Account that is being invited will need to provide a VPC, one Subnet from within it, and a [**Cross Account Execution Role**](cross_account_execution_role).

## Adding an AWS Account

To add an AWS Account to the solution, follow these steps:

1. In the portal navigate to the **Accounts** page using the menu on the left.
2. Click on the **AWS Accounts** tab along the top.
3. Click the **Add AWS Account** button.
4. Type a name for the AWS Account in the **Account Name** field.
5. Provide the AWS Account ID (12 digits) in the **AWS Account ID** field.
6. Provide the Role Arn that has created when creating a [**Cross Account Execution Role**](cross_account_execution_role) in the **Role Arn** field.
7. Enter the External ID for the AWS Account in the **External ID** field.
8. Provide the VPC ID that [**Workspaces**](../../../common/workspaces/introduction.md) will be deployed into in the **VPC ID** field.
9. Provide the KMS Encryption Key ARN for the AWS Account in the **KMS Encryption Key ARN** field.
