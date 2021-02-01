---
id: account_structure
title: Account Structure
sidebar_label: Account Structure
---

Service Workbench uses _three_ types of accounts. You will see these account names throughout the _Service Workbench Deployment Guide_. 
- **Main**: The account from which Service Workbench is deployed. Will be billed for all AWS usage charges in this deployment.
- **Master**: Holds the AWS Organization which creates Member accounts.
- **Member**: User accounts created within Service Workbench for individuals.

Read the following files in the source code documentation to learn more about the different types of AWS accounts within Service Workbench: 

- `README.md`
- `main/documentation/aws-accounts-readme.md`
- `main/solution/prepare-master-acc/README.md`

## Enable Local Users

Local users are created only within the solution. Their credentials are stored in [Amazon DynamoDB](https://aws.amazon.com/dynamodb/?nc2=type_a). This is the easiest way to install. The alternative is to integrate with an Active Directory.
