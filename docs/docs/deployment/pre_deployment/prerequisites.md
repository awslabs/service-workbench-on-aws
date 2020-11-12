---
id: accounts
title: Accounts
sidebar_label: Accounts
---

## Deployment Account

Service Workbench can be deployed from either a master or member account of an AWS Organization, or from an account not associated with an Organization.  The choice is determined by customer preference.  The account in which Service Workbench is deployed, is known as the Service Workbench *Main* account.  During the installation you will require access to this main account, either through direct login, or through an AWS Command Line Interface [Profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html)

## Billing Account

Within Service Workbench, all resources are deployed against an account which is responsible for charges incurred by that resource.  Billing accounts can be either **Created** by Service Workbench (vending an account within the Organization), or can be **Added** (importing an existing external account for billing purposes).  There can be multiple billing accounts set up within Service Workbench, with projects created under each account.

During the installation, we will require access to the billing account (Created or Added).  In the case of creating accounts within Service Workbench, if the main account is associated with an Organization, you will require access to the Master account of the Organization during the installation.  In the case of adding accounts to Service Workbench, you will require access to the added account during the installation.  In both cases, we run a script or CloudFormation template within the billing account to create a role linking the main account with the billing account.  Access can be via login, or by named profiles, as above.

## Cost Explorer

In order to see any actual cost in dashboards and workspaces, the master account must have Cost Explorer set up. 
Service Workbench has the ability to provide detailed cost breakdowns based on cost allocation tags. In order to benefit from this feature, you should activate the following list of cost allocation tags in the [Billing](https://console.aws.amazon.com/billing/home?#/tags) service of the AWS accounts that will host workspaces : `CreatedBy`, `Env`, `Proj`.
