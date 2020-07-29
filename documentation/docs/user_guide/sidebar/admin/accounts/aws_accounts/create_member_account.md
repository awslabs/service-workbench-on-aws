---
id: create_member_account
title: Create an AWS Account
sidebar_label: Create an AWS Account
---

When you attempt to create a [**Member AWS Account**](introduction), the [**Main AWS Account**](introduction) will assume a role in the [**Master AWS Account**](introduction). Once the role has been assumed, it will then create a [**Member AWS Account**](introduction).

Once the [**Member AWS Account**](introduction) has been created, the [**Main AWS Account**](introduction) will assume a role in that account and launch a CloudFormation template to build resources (VPC, Subnet, [**Cross Account Execution Role**](cross_account_execution_role)).

To create a new [**Member AWS Account**](introduction), follow these steps:

1. In the portal navigate to the **Accounts** page using the menu on the left.
2. Click the **AWS Accounts** tab along the top.
3. Click the **Create AWS Account** button.
4. Type a name for the AWS Account in the **Account Name** field.
5. Type an email address for the AWS Account in the **AWS Account Email** field.
6. Provide the [**Master Role**](master_role) ARN for the [**Master AWS Account**](introduction) in the **Master Role Arn** field.
7. Type the External ID for the AWS Account in the **External ID** field.
8. Type a description for the AWS Account in the **Description** field.
