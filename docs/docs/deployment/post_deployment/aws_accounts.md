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

For additional details on configuring an account to be the Master Account, see [Prepare the Master Account](/deployment/reference/prepare_master_account) in the 'Reference' section.


### AWS Organizations
In the [AWS Management Console](https://aws.amazon.com/console/?nc2=type_a), navigate to '**AWS Organizations**' to ensure that an Organization exists for the **Master** account. If it does not, then you will need to create a new one. There is no configuration to set; Service Workbench will create a new account in the AWS Organization for this deployment, named after the **Stage Name** used at deployment.


### Creating a new Account

This will create a new **Member** AWS account in the Organization, whose billing will go to the **Master** account of the Organization. See **Figure 1**.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_00.jpg')} />

_**Figure 1: Create AWS Account**_

To create the account, perform the following actions:

1. In the Service Workbench console, navigate to '**Accounts → AWS Accounts**' and click **Create AWS Account**.
    *  In **Role ARN**, fill in the **Master Role ARN** copied from the ‘Configure Master Account’ step described above.
    * The email address that you specify here must be unique within the Organization.
    * The **External ID** by default is the string **workbench**.  See  [IAM](/development/aws_services#IAM) for information on how to configure this to another value.
2. After a minute, the following information displays in the **AWS Accounts** tab:
    *  *‘Trying to create accountID: xxx’*
    * A workflow in progress in **Workflows → Provision Account** (see [Workflows](http://swb-documentation.s3-website-us-east-1.amazonaws.com/user_guide/sidebar/admin/workflows/introduction) 
     _**Note**: If instead you see an error message such as, ‘Stop Internal State Account ID not found’, check that there is an AWS Organization in the console of your **Master** account, if deploying Service Workbench in the **Master** account.  If you are deploying in a **Member** account, check and ensure that you  followed the steps described in [Prepare the Master Account](/deployment/post_deployment/prepare_master_account)._
    * Optionally, in the AWS console, you can inspect the following resources deployed by this script:
        * In AWS CloudFormation, a stack **prep-master** will be running.  It creates the **Master** role and its output is the **Master Role ARN**.
        * In the AWS Organization, in the **Master** account (see [IAM](/development/aws_services#Organizations)), the new account will display. 
        * In IAM, the new **Master** role will be created
3. Once the account is created it will be listed in **AWS Accounts**, see **Figure 2**.
 
<img src={useBaseUrl('img/deployment/post_deployment/create_account_02.jpg')} />

_**Figure 2: AWS Accounts with New Account**_


## Add  AWS  Account

Adding an existing AWS account enables Service Workbench to launch research Workspaces into it. The existing account is reponsible for billing.

### Gather Role ARNs

This step is run in the **Main** account, the account where you have deployed Service Workbench.  See [Prepare SDC Configuration Files](/deployment/pre_deployment/configuration#Prepare_SDC_Configuration_Files) for information on how to specify the correct profile.

1. Run the following command in the `main/solution/backend` folder:

```{.sh}
    pnpx sls info --verbose --stage <stagename>
```

The output will contain similar lines to the following:

```{.sh}
    Stack Outputs
    AuthenticationLayerHandlerRoleArn: arn:aws:iam::0000:role/stage-va-sw-backend-RoleAuthenticationLayerHan-F00
    EnvMgmtRoleArn: arn:aws:iam::0000:role/stage-va-sw-EnvMgmt
    ApiHandlerRoleArn: arn:aws:iam::0000:role/stage-va-sw-ApiHandler
    WorkflowLoopRunnerRoleArn: arn:aws:iam::0000:role/stage-va-sw-WorkflowLoopRunner
    OpenDataScrapeHandlerRoleArn: arn:aws:iam::0000:role/stage-va-sw-backend-RoleOpenDataScrapeHandler-F00
    ServiceEndpoint: https://f00.execute-api.us-east-1.amazonaws.com/demo
    ServerlessDeploymentBucketName: 0000-stage-va-sw-artifacts
```

2. Copy the values for **ApiHandlerRoleArn** and **WorkflowLoopRunnerRoleArn**.

### Prepare the Existing AWS Account

This step prepares the existing AWS account that you wish to add to Service Workench by running an onboarding template.

1. In the [AWS Management Console](https://aws.amazon.com/console/?nc2=type_a), navigate to '**Amazon CloudFormation**'.
2. Create a new stack in CloudFormation.  Select *Upload a template file* and locate the template file `addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/onboard-account.cfn.yml` from the source code.
3. On the next screen 'Specify stack details' enter the following values from **Table 3**:


Field                        | Value                      
---------------------------- | ------------------------------------------------
Namespace                    | Short string (eg: stage name)                  
CentralAccountId             | Service Workbench Main account ID                  
ExternalId                   | As specified (default: **workbench**)
VpcCidr                      | Retain default (10.0.0.0/16) 
VpcPublicSubnet1Cidr         | Retain default (10.0.0.0/19)                  
ApiHandlerArn                | **ApiHandlerRoleArn** value from above        
LaunchConstraintPolicyPrefix | Retain default (*)                            
LaunchConstraintRolePrefix   | Retain default (*)                            
WorkflowRoleArn              | **WorkflowLoopRunnerRoleArn** value from above

_**Table 3: Stack Details**_

4. Deploy the stack.
5. After the stack has deployed, view the output, which will contain values similar to the following in **Table 4**:

|             Key              |                          Value                          |
-------------------------------|---------------------------------------------------------
| CrossAccountEnvMgmtRoleArn   | arn:aws:iam::0000:role/sw-stage-xacc-env-mgmt      |
| CrossAccountExecutionRoleArn | arn:aws:iam::0000:role/sw-stage-cross-account-role |
| EncryptionKeyArn             | arn:aws:kms:us-east-2:0000:key/f00-f00-f00              |
| VPC                          | vpc-f00f00                                              |
| VpcPublicSubnet1             | subnet-f00f00                                           |

_**Table 4: Stack Output**_

6. Copy the values down for the next step.

### Adding the Account in Service Workbench

This step is run in the Service Workbench administrator interface and uses values from the previous step.

1. In the Service Workbench administrative interface, click the **AWS Accounts** tab. See **Figure 3**.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_01.jpg')} />

_**Figure 3: Add AWS Account**_

2.  Click **Add AWS Account**. Enter the account information from the following **Table 5**:

|             Field            |                 Value                  |
|------------------------------|----------------------------------------|
| Account Name                 | As desired                             |
| AWS Account ID               | 12-digit ID of imported account        |
| Role ARN                     | **CrossAccountExecutionRoleArn** value |
| AWS Service Catalog Role Arn | **CrossAccountEnvMgmtRoleArn** value   |
| External ID                  | As specified (default: **workbench**)  |
| Description                  | As desired                             |
| VPC ID                       | **VPC** value                          |
| Subnet ID                    | **VpcPublicSubnet1** value             |
| KMS Encryption Key ARN       | **EncryptionKeyArn** value             |

_**Table 5: AWS Account Information**_

3. Once the account is added it will be listed in **AWS Accounts**, see **Figure 4**.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_02.jpg')} />

_**Figure 4: AWS Accounts with New Account**_