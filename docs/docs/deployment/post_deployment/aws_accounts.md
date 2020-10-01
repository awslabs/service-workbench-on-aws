---
id: aws_accounts
title: AWS Accounts
sidebar_label: AWS Accounts
---

import useBaseUrl from '@docusaurus/useBaseUrl';

After logging in as root for the first time, from the Accounts page in the [SideBar](/user_guide/introduction), create or add one or more AWS Accounts from the Accounts tab.  Accounts are responsible for the charges incurred by the resources deployed within Service Workbench.  These billing accounts are a separate concept from the Master, Member, or Main accounts, however the accounts used to host Service Workbench may be added as a billing account.

**Create AWS Account** creates a new AWS account within the Organization hosted by the Master account.  This account will not belong to any OU within the Organization.  If Service Workbench was deployed from a Member account of the Organization, the newly created account will be at the same level as the account hosting Service Workbench (the Main account).

**Add AWS Account** imports an existing account into Service Workbench.  This account is independent of the Master or Main accounts, or the Organization.

Every user is linked to an Account through a Project and an Index, so at least one billing account must be created or added before creating the first user.  Note that to Service Workbench, there is no difference between an account created through Create AWS Account, and one added through Add AWS Account.  They are both used for billing only.


## Create  AWS  Account

Using this option, you will create a Member account within the Organization, and an IAM Role allowing the Master account to assume role into the Member account.  The ARN of this role is used during the Create Account process in Service Workbench.

### AWS Organization

The new account will be created within an AWS Organization in the Master account.  If Service Workbench was deployed in the Master account, ensure that the Master account contains an AWS Organization.  If there is no Organization, in the AWS console, create an AWS Organization in the Master account.  There is no configuration necessary.  If you already have an Organization created there is no further action required.

If Service Workbench was deployed in a Member account, that account already exists in a Member account in the Organization. 

### Creating an Account

This will create a Member account in the Organization, whose billing will go to the Master account of the Organization.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_00.jpg')} />

* In the Service Workbench console, go to Accounts → AWS Accounts and click **Create AWS Account**
    * Fill in Master Role ARN copied from [Prepare the Master Account](/deployment/post_deployment/prepare_master_account).
    * The email address must be unique within the Organization
    * The External ID by default is the string **workbench**.  See  [IAM](/development/aws_services#IAM) for how to configure this to another value.
* Click **Create AWS Account** and after a minute you should see:
    * ‘Trying to create accountID: xxx’ in the AWS Accounts tab
    * A workflow in progress in Workflows → Provision Account (see [Workflows](/user_guide/introduction))
        * If instead you see an error message ‘Stop Internal State Account ID not found’, check that there is an AWS Organization in the console of your Master account, if deploying Service Workbench in the Master account.  If deploying in a Member account, check that you have followed the steps in [Prepare the Master Account](/deployment/post_deployment/prepare_master_account).
    * In the AWS console you can optionally inspect the resources deployed by this script:
        * In CloudFormation, a stack **prep-master** will be running.  It creates the master role and its output is the master role ARN.
        * In the AWS Organization in the Master account (see [IAM](/development/aws_services#Organizations)), the new account will appear 
        * In IAM, the new master role will be created
* Once the account has been added it will be listed in **AWS Accounts**

<img src={useBaseUrl('img/deployment/post_deployment/create_account_02.jpg')} />

## Add  AWS  Account

This option will make an already-existing AWS account available as a billing account in AWS.  No new account will be created in this process.

### Gather Role ARNs

This step is run in the Main account, the account where you have deployed Service Workbench.  See [Prepare SDC Configuration Files](/deployment/pre_deployment/configuration#Prepare_SDC_Configuration_Files) for how to specify the correct profile.

Run the following command in the `main/solution/backend` folder:

```{.sh}
    pnpx sls info --verbose --stage <stagename>
```

The output will contain similar lines to:

```{.sh}
    Stack Outputs
    AuthenticationLayerHandlerRoleArn: arn:aws:iam::0000:role/stage-va-galileo-backend-RoleAuthenticationLayerHan-F00
    EnvMgmtRoleArn: arn:aws:iam::0000:role/stage-va-galileo-EnvMgmt
    ApiHandlerRoleArn: arn:aws:iam::0000:role/stage-va-galileo-ApiHandler
    WorkflowLoopRunnerRoleArn: arn:aws:iam::0000:role/stage-va-galileo-WorkflowLoopRunner
    OpenDataScrapeHandlerRoleArn: arn:aws:iam::0000:role/stage-va-galileo-backend-RoleOpenDataScrapeHandler-F00
    ServiceEndpoint: https://f00.execute-api.us-east-1.amazonaws.com/demo
    ServerlessDeploymentBucketName: 0000-stage-va-galileo-artifacts
```

Copy the values for **ApiHandlerRoleArn** and **WorkflowLoopRunnerRoleArn**.

### Run the Onboard Account template

This step is run in the account you wish to onboard (ie make available for billing within Service Workbench)

* Create a new stack in CloudFormation.  Select *Upload a template file* and locate the template file `addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/onboard-account.cfn.yml` from the source code.
* On the next screen 'Specify stack details' enter the following:


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

Deploy the stack.  The Outputs of the stack will contain values similar to:


|             Key              |                          Value                          |
-------------------------------|---------------------------------------------------------
| CrossAccountEnvMgmtRoleArn   | arn:aws:iam::0000:role/galileo-stage-xacc-env-mgmt      |
| CrossAccountExecutionRoleArn | arn:aws:iam::0000:role/galileo-stage-cross-account-role |
| EncryptionKeyArn             | arn:aws:kms:us-east-2:0000:key/f00-f00-f00              |
| VPC                          | vpc-f00f00                                              |
| VpcPublicSubnet1             | subnet-f00f00                                           |

### Adding the Account in Service Workbench

This step is run in the Service Workbench administrator interface and uses values from the output of the Onboard Account template in the previous step.

<img src={useBaseUrl('img/deployment/post_deployment/create_account_01.jpg')} />

Open the Accounts tab of an Administrator login in Service Workbench, select **Add AWS Account**, and enter this information.

|            Field             |                 Value                  |
|------------------------------|----------------------------------------|
| Account Name                 | As desired                             |
| AWS Account ID               | 12-digit ID of imported account        |
| Role ARN                     | **CrossAccountExecutionRoleArn** value |
| AWS Service Catalog Role Arn | **CrossAccountEnvMgmtRoleArn** value   |
| External ID                  | As specified (default: **galileo**)    |
| Description                  | As desired                             |
| VPC ID                       | **VPC** value                          |
| Subnet ID                    | **VpcPublicSubnet1** value             |
| KMS Encryption Key ARN       | **EncryptionKeyArn** value             |
