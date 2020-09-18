---
id: link_aws_account
title: Create or add an AWS Account
sidebar_label: Create or add an AWS Account
---

import useBaseUrl from '@docusaurus/useBaseUrl';

After logging in as root for the first time, from the [SideBar's Accounts page](/user_guide/introduction), create an AWS Account
within the solution UI. Every user belongs to an Account, so this step must be
completed before creating the first user.

There are two categories of AWS Account within the solution: Internal and
External. Internal accounts are those linked to the AWS account from
which you deployed the solution. Users linked to an internal account will all
be billed to that AWS account. External accounts supply their own AWS
account, and users linked to an external account are billed to the
external AWS account. This is how external researchers can collaborate
and share data within the solution but remain responsible for their own
billing.

## Create Interal AWS Account

In this step you will run a script that creates an [IAM Role](/deployment/reference/iam_role) allowing the
Main account to assume role into the Master account. The ARN of this
role is used to create a new account within the solution.

### Create AWS Organization

In the AWS console, create an [Organization](/deployment/reference/aws_services) in the Master account. There is no configuration; the solution
will create a new account in the Organization for this deployment, named
after the stage name used at deployment. If you already have an
Organization created there is no further action required.

### Get Master Account Role ARN

- Read `main/solution/prepare-master-acc/README.md`

-


    Run `scripts/master-account-deploy.sh <stage>`

    :   -   This will take about 8 minutes

- Copy the displayed ARN of the newly-created master role

### Create AWS Account

This will create an account whose billing will go to the Main account
(the account in which the solution is deployed)

<img src={useBaseUrl('img/deployment/post_deployment/create_account_00.jpg')} />

- In the solution UI, go to Accounts → AWS Accounts and click
  **Create AWS Account**

  > - Fill in Master Role ARN copied from the previous step
  > - The email address must be unique within the Organization
  > - There is a default External ID string. See [IAM Role](/deployment/reference/iam_role) for how to
  >   configure this to another value.

- Click **Create AWS Account** and after a minute you should see:

  > - 'Trying to create accountID: xxx' in the AWS Accounts tab
  >
  > - A workflow in progress in Workflows → Provision Account (see [SideBar's Accounts page](/user_guide/introduction))
  >
  >   > - If instead you see an error message 'Stop Internal State
  >   >   Account ID not found', check the AWS Organization in the
  >   >   console of your Master account. Your account must not
  >   >   belong to an existing Organization. You must either have
  >   >   an existing Organization or be able to create an
  >   >   Organization
  >
  > - In the AWS console you can optionally inspect the resources
  >   deployed by this script:
  >
  >   > - In CloudFormation, a stack `prep-master` will be
  >   >   running. It creates the master role and its output is
  >   >   the master role ARN.
  >   > - In the AWS Organization in the Master account (see
  >   >   [Organization](/deployment/reference/aws_services)), the new account will appear
  >   > - In IAM, the new master role will be created

- Once the account has been added it will be listed in **AWS
  Accounts**

<img src={useBaseUrl('img/deployment/post_deployment/create_account_02.jpg')} />

## Add External AWS Account

- This will create an account whose billing will go to an external AWS
  account (such as for an external researcher)
- Deploy
  `addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/onboard-account.cfn.yml`
- This will output Role ARN, VPC ID etc
- Open the Accounts tab when logged in as an Administrator user to the solution UI, select
  'Add AWS Account', and enter this information.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_01.jpg')} />
