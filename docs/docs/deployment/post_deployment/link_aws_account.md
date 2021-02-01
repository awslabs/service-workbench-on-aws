---
id: link_aws_account
title: Create or Add an AWS Account
sidebar_label: Create or Add an AWS Account
---

import useBaseUrl from '@docusaurus/useBaseUrl';

There are two categories of AWS Account within Service Workbench: **Internal accounts** and **External accounts**. 
* **Internal accounts**: Internal accounts are those linked to the AWS account from which you deployed Service Workbench. Users linked to an internal account will all be billed to that AWS account. 
* **External accounts**: External accounts supply their own AWS account, and users linked to an external account are billed to the external AWS account. This is how external researchers can collaborate and share data within Service Workbench, but remain responsible for their own billing.

After logging in to the Service Workbench web interface for the first time as **root** user, perform the following actions: 
1.	From the sidebar, click ‘**Accounts**’ to display the ‘**Accounts**’ page. 
2.	On the ‘**Accounts**’ page, create an **AWS Account** within Service Workbench.

## Create AWS Organization
In the AWS Management Console, create an AWS Organization in the **Master** account. There is no configuration to set; Service Workbench will create a new account in the AWS Organization for this deployment, named after the **Stage Name** used at deployment. If you already created an AWS Organization, there is no further action required.

## Get Master Account Role ARN
1.	Read the file:  `main/solution/prepare-master-acc/README.md`.
2.	Change directory to the **root folder** and run the command below. This command will take about 8 minutes to execute. 
```
`scripts/master-account-deploy.sh <stage>` 
```
The output of this command is described in **Figure 2**.
<img src={useBaseUrl('img/deployment/post_deployment/service_information_00')} />
**_Figure 2: Service Information_**
3.	Copy the value of the **Master Role ARN** from the output of the previous step. This value is the ARN of the newly created **Master** role.

### Create AWS Account

This will create an account whose billing will go to the **Main** account. The **Main** account is the account in which Service Workbench is deployed. See **Figure 3**.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_00.jpg')} />
**_Figure 3: Create AWS Account_**

To create the AWS Account, perform the following actions: 
1.	In the Service Workbench console, navigate to ‘**Accounts > AWS Accounts**’ and click ‘**Create AWS Account**’. 
2.	Specify the following details:
–	In ‘**Role ARN**’, fill in the **Master Role ARN** copied from the previous step. 
–	The **email address** that you specify here must be unique within the AWS Organization.
–	The **External ID** by default is the string workbench. See [IAM Role](/docs/deployment/reference/iam_role) for information on how to configure this to another value.

After a minute, the following information displays in the ‘**AWS Accounts**’ tab:
–	“_Trying to create accountID: xxx_”. 
–	A workflow is in progress in ‘**Workflows > Provision Account**’ (see the sidebar's ‘Accounts’ page.)

_**Note**: If instead you see an error message such as, “Stop Internal State Account ID not found”, check the AWS Organization in the console of your **Master** account. As described in [prerequisites](/docs/deployment/pre_deployment/prequisites), your account must not belong to an existing AWS Organization. You must either have an existing AWS Organization or be able to create a new AWS Organization._
1.	Optionally, in the AWS console, you can inspect the following resources deployed by this script: 
–	In AWS CloudFormation, a stack prep-master will be running. It creates the **Master** role and its output is the **Master Role ARN**.
–	In AWS Organization, the new account will display in the **Master** account
–	In AWS IAM, the new **Master** role will be created.
Once you add the account, it gets listed in ‘**AWS Accounts**’ as shown in **Figure 4**.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_02.jpg')} />
**_Figure 4: Example of an AWS Account_**

## Add External AWS Account

This will create an account whose billing will go to an external AWS account, such as an external researcher.
1.	Deploy the file below. It will output Role ARN, VPC ID, etc.
```
addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/onboard-account.cfn.yml
```
2.	In the Service Workbench administrative interface, click the ‘**AWS Accounts**’ tab of an administrator login. See **Figure 5**. 
3.	Click ‘**Add AWS Account**’ and enter the account information.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_01.jpg')} />
**_Figure 5: Add AWS Account_**
