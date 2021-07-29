---
id: aws_accounts
title: Create or Add Accounts
sidebar_label: Create or Add Accounts
---

import useBaseUrl from '@docusaurus/useBaseUrl';

After logging in as **root** user for the first time, go to the '**Accounts**' page in the [SideBar](/user_guide/introduction). Service Workbench uses AWS accounts on this page for launching research workspaces. You can add existing AWS accounts or create new ones on the '**Accounts**' tab.  Accounts are responsible for the charges incurred by the resources that are deployed within the Service Workbench.

* **Create AWS Account**: Creates a new AWS account using AWS Organizations.

* **Add AWS Account**: Imports an existing AWS account, which will be responsible for its own billing.

Every user is linked to an **Account** through a **Project** and an **Index**, so at least one account must be created or added before creating the first user.

_**Important:** If you do not need to create new AWS accounts from within Service Workbench, then skip to the next section, 'Add AWS Account' section below._

## Create  AWS  Account

### Prerequisites
Before creating an AWS account from Service Workbench, some prequisites must be met:
* Configure an existing AWS account to be the **Master** account for Service Workbench. When Service Workbench creates new AWS accounts, billing for those accounts will go to the **Master** account.
* Ensure the **Master** account has AWS Organizations enabled.


### Configure Master Account
To configure the **Master** account: 

1. Read the file: `main/solution/prepare-master-acc/README.md`. 
2. Change directory to the **root folder** and run the command below. This command will take about 8 minutes to execute.
```scripts/master-account-deploy.sh <stage>```
The output of this command includes a **Master Role ARN** for the the next step.

For more information on configuring an account to be the Master Account, see [Prepare the Master Account](/deployment/reference/prepare_master_account) in the 'Reference' section.


### AWS Organizations
In the [AWS Management Console](https://aws.amazon.com/console/?nc2=type_a), navigate to '**AWS Organizations**' to ensure that an Organization exists for the **Master** account. If it does not, then you will need to create a new one. There is no configuration to set; Service Workbench will create a new account in the AWS Organization for this deployment, named after the **Stage Name** used at deployment.


### Creating a new Account

This will create a new **Member** AWS account in the Organization, whose billing will go to the **Master** account of the Organization. 

<img src={useBaseUrl('img/deployment/post_deployment/create_account_00.jpg')} />

_**Figure 1: Create AWS Account**_

To create the account, perform the following actions:

1. In the Service Workbench console, navigate to '**Accounts → AWS Accounts**' and click **Create AWS Account**.
    *  In **Role ARN**, fill in the **Master Role ARN** copied from the ‘Configure Master Account’ step described above.
    * The email address that you specify here must be unique within the Organization.
    * The **External ID** by default is the string **workbench**.  See  [IAM](/deployment/reference/aws_services#IAM) for information on how to configure this to another value.
2. After a minute, the following information displays in the **AWS Accounts** tab:
    *  *‘Trying to create accountID: xxx’*
    * A workflow in progress in **Workflows → Provision Account** (see [Workflows](http://swb-documentation.s3-website-us-east-1.amazonaws.com/user_guide/sidebar/admin/workflows/introduction) 

     _**Note**: If instead you see an error message such as, ‘Stop Internal State Account ID not found’, check that there is an AWS Organization in the console of your **Master** account, if deploying Service Workbench in the **Master** account.  If you are deploying in a **Member** account, check and ensure that you  followed the steps described in [Prepare the Master Account](/deployment/reference/prepare_master_account)._
    * Optionally, in the AWS console, you can inspect the following resources deployed by this script:
        * In AWS CloudFormation, a stack **prep-master** will be running.  It creates the **Master** role and its output is the **Master Role ARN**.
        * In the AWS Organization, in the **Master** account (see [IAM](/deployment/reference/aws_services#Organizations), the new account will display. 
        * In IAM, the new **Master** role will be created
3. Once the account is created it will be listed in **AWS Accounts**, see **Figure 2**.
 
<img src={useBaseUrl('img/deployment/post_deployment/create_account_02.jpg')} />

_**Figure 2: AWS accounts with new account**_


## Add  AWS  Account

Adding an existing AWS account enables Service Workbench to launch research Workspaces into it. The existing account is responsible for billing.

### Adding the account in Service Workbench

This step is run in the Service Workbench administrator interface and uses values from the previous step.

1. Sign in to the AWS Management Console for the corresponding account in a separate tab.

2. In the Service Workbench administrative interface, click the **AWS Accounts** tab. 

<img src={useBaseUrl('img/deployment/post_deployment/create_account_01.jpg')} />

_**Figure 3: Add AWS account**_

3.  Choose **Add AWS Account**. Enter the account information from the following table:

|             Field            |                 Value                  |
|------------------------------|----------------------------------------|
| Account Name                 | As desired                             |
| AWS Account ID               | 12-digit ID of imported account        |
| Description                  | As desired                             |


_**Table : AWS Account Information**_

4. Choose **Onboard AWS Account**.

<img src={useBaseUrl('img/deployment/post_deployment/onboard-aws-account.png')} />

_**Figure 4: AWS accounts with new account**_

5. The **Onboard AWS Account** page displays the CloudFormation stack name and the AWS account details.

<img src={useBaseUrl('img/deployment/post_deployment/onboard-aws-account1.png')} />

_**Figure 5: Displaying the CloudFormation stack name**_

6. Choose **Create Stack**.
7. The **Quick create stack** page appears and it displays the template URL, stack name and parameters. 

<img src={useBaseUrl('img/deployment/post_deployment/quick-create-stack.png')} />

_**Figure 6: Creating the stack**_

8. Select **I acknowledge that AWS CloudFormation might create IAM resources with custom names**.

<img src={useBaseUrl('img/deployment/post_deployment/acknowledge.png')} />

_**Figure 7: Acknowlegement screen**_

9. Choose **Create stack**.

10. Once the account is added it will be listed in AWS Accounts. When the associated cloudformation stack finishes provisioning, the account displays as **Up-to-Date**.

<img src={useBaseUrl('img/deployment/post_deployment/new_account1.jpg')} />

_**Figure 8: AWS accounts with new account**_
### Updating a previously onboarded account

When new versions of Service Workbench are launched, it might be necessary to change the resources Service Workbench uses to access onboarded accounts. The AWS Accounts page displays information on which accounts are up-to-date, and which need to be updated. 

For accounts that need to be updated, follow these steps:

1. Sign in to the AWS Management Console for the corresponding account in a separate tab.
2. On the **AWS Accounts** tab, choose **Update Permissions**.

<img src={useBaseUrl('img/deployment/post_deployment/update-perm.png')} />

_**Figure 9: Update permissions for AWS account**_

3. The **Onboarding AWS Accounts** page appears. Choose **Update Stack**.

<img src={useBaseUrl('img/deployment/post_deployment/update-perm1.png')} />

_**Figure 10: Stack Details**_

4. The following windows appear in the AWS CloudFormation console:
     a. **Update stack**
     b. **Specify stack details**
     c. **Configure stack options**
     d.	**Review**
     Choose **Next** on every page.

<img src={useBaseUrl('img/deployment/post_deployment/update-perm2.png')} />

_**Figure 11: Review account details**_

5. Select **I acknowledge that AWS CloudFormation might create IAM resources with custom names**.

<img src={useBaseUrl('img/deployment/post_deployment/acknowledge1.png')} />

_**Figure 12: Acknowledgement window**_

6. Choose **Update Stack**. No inputs are necessary on any page, although you can observe what changes will be introduced by looking at the ChangeSet displayed on the final page.
7. You can observe the state of the account from Service Workbench in the **AWS Accounts** page. For this account, Service Workbench detects that the account’s CloudFormation stack is updating, and switches the account into the Pending state. When the stack finishes updating, the account displays as **Up-to-Date**.

### Updating accounts onboarded prior to July 31, 2021

1. Sign in to the AWS Management Console for the corresponding account in a separate tab.
2. On the **AWS Accounts** tab, choose **Re-onboard account**.

 <img src={useBaseUrl('img/deployment/post_deployment/reonboard1.png')} />

_**Figure 13: Onboarding an account**_

3.	The **Onboarding AWS Accounts** page appears. Choose **Onboard New Account**.
4.	Select the checkbox to acknowledge the warning message.

<img src={useBaseUrl('img/deployment/post_deployment/reonboard2.png')} />

_**Figure 14: Acknowledging the warning message**_
 
5.	Choose **Create Stack**.
6.	The **Quick create** stack page appears and it displays the template URL, stack name and parameters. 

 <img src={useBaseUrl('img/deployment/post_deployment/reonboard3.png')} />

_**Figure 15: Creating the stack**_

7.	Select **I acknowledge that AWS CloudFormation might create IAM resources with custom names**.

 <img src={useBaseUrl('img/deployment/post_deployment/acknowledge2.png')} />

_**Figure 16: Acknowledgement window**_

8.	Choose **Create stack**.
9.	Once the account is added it will be listed in AWS Accounts. When the associated cloudformation stack finishes provisioning, the account displays as Up-to-Date.
