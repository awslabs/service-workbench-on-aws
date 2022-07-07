---
id: account_structure
title: Account structure
sidebar_label: Account structure
---

Service Workbench uses _three_ types of accounts. You will see these account names throughout the documentation. 

- **Organizational** : Holds the AWS Organization which creates hosting accounts.  Note that you may already have a method of obtaining AWS accounts supported by your organization.  If this is the case, you will not create an organizational account or use the Create Account functionality within Service Workbench when onboarding a hosting account.
- **Main**: The account from which Service Workbench is deployed. Will be billed for all AWS usage charges in this deployment.
- **Master**: Holds the AWS Organization which creates member accounts.
- **Hosting**: Accounts that are established associated to the Service Workbench main account through the onboarding process to host the compute resources (Amazon SageMaker notebook instances, Amazon EC2 Windows and Linux instances, Amazon EMR clusters) associated to Service Workbench workspaces.

Read the following files in the source code documentation to learn more about the different types of AWS accounts within Service Workbench: 

- `README.md`
- `main/solution/prepare-master-acc/README.md`

## Enable Local Users

Local users are created only within the solution. Their credentials are stored in [Amazon DynamoDB](https://aws.amazon.com/dynamodb/?nc2=type_a). This is the easiest way to install. The alternative is to integrate with an Active Directory.
