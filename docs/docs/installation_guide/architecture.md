---
id: architecture
title: Service Workbench architecture
sidebar_label: Service Workbench architecture
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Service Workbench integrates existing AWS services, such as [Amazon CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html), [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html), and [AWS Step Functions](https://docs.aws.amazon.com/lambda/latest/dg/lambda-stepfunctions.html). Service Workbench enables you to create your own custom templates and share those templates with other organizations. To provide cost transparency, Service Workbench has been integrated with [AWS Cost Explorer](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/ce-getting-started.html), [AWS Budgets](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/budgets-managing-costs.html), and [AWS Organizations](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/consolidated-billing.html).

<img src={useBaseUrl('img/deployment/installation/SWBArchitecture.png')} />

### Authentication

Service Workbench on AWS can use [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) as a source of authentication. Amazon Cognito can federate with different authentication providers, which make it easier to federate with Active Directory, Auth0, or other identity providers.

### Storage

Service Workbench distinguishes between three types of research study data: My Studies, Organizational Studies, and Open Data. The former two are datasets stored and maintained either by you or the overall organization or groups. Open Data refers to data available through open data on AWS. Frequent scans against the open dataset ensure that latest open datasets are available to users.

### AWS Service Catalog

The core of the Workspace management in Service Workbench is [AWS Service Catalog](https://aws.amazon.com/servicecatalog/?aws-service-catalog.sort-by=item.additionalFields.createdDate&aws-service-catalog.sort-order=desc). Here, the system finds and manages the templates that are used to define Workspaces. When you want to use a new Workspace type, it can be created as an [AWS CloudFormation template](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html) inside AWS Service Catalog. 

### Workspace management

Besides provisioning an environment using templates, you can access your Workspaces, view billing details, or decommission them.

<img src={useBaseUrl('img/deployment/installation/workspace_management.png')} />

### Cost control

#### Accounts, indexes, and projects

Service Workbench uses AWS accounts to manage compute Workspaces. This way, you can use different accounts for different projects, cost centers, or another purpose and manage cost. With the vending capability, an administrator can generate new AWS accounts under the same AWS Organizations by using the Service Workbench interface.

#### Dashboard

A dashboard displays a quick overview of the cost your Workspaces or projects have accumulated. This helps you to stay on budget and track Workspaces that possibly consume more resources.

<img src={useBaseUrl('img/deployment/installation/dashboard.png')} />

### Workspace sizes

When you create a Workspace from a template, you can choose the Workspace type in addition to multiple environment sizes. An administrator can pre-define these sizes and associate them with users based on individual permissions.

<img src={useBaseUrl('img/deployment/installation/workspace_sizes.png')} />