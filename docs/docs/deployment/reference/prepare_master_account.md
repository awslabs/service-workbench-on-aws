---
id: prepare_master_account
title: Prepare the organizational account
sidebar_label: Prepare the organizational Account
---

import useBaseUrl from '@docusaurus/useBaseUrl';

**Note**: *This section is required only if Service Workbench is to be used to vend accounts in the AWS Organization by using **Create Account**. If Service Workbench uses only billing accounts onboarded using **Add Account**, this section can be omitted.*

In this step, you deploy the prepare_master_acc Separately Deployable Component (SDC) in the `main/solution/prepare-master-acc` directory. This creates a role in the organizational account that allows `AssumeRole`, and has the main account as its trusted entity. If you have deployed Service Workbench in an organizational account, the main account is also the organizational account, and the trusted entity is the same account ID as the organizational account.

The default settings in this step are:
* **Main Account ID**: The current AWS Account ID
* **External ID**: The string **workbench**

These default values are sufficient if you are deploying Service Workbench to an organizational account, and the default profile has permissions for the organizational account, since the main account is also the organizational account. If deploying Service Workbench to the main AWS account that is not the same account as the organizational account, you must create a configuration file to specify the main account ID and the profile to use. This profile must have permissions for the organizational account.

### Create a Configuration File

If deploying Service Workbench in an account other than that accessed by the current default profile, create a stage-named configuration file in the directory `main/solution/prepare-master-acc/config/settings` by copying `example.yml` to `<stage>.yml`.  Edit the file as appropriate:

* **awsProfile**: The AWS Credentials profile with permissions for the Master account.
* **mainAccountID**: The 12 digit AWS Account ID for the Main AWS account, where the solution is deployed.
* **externalId**: As desired.  The string **workbench** is often used.  This string will be needed when creating an AWS account within Service Workbench.

### Enable AWS Organizations in the organizational account

In the [AWS Management Console](https://aws.amazon.com/console/?nc2=type_a), navigate to AWS Organizations to ensure that an organization exists for the organizational account. If it does not, then create a new one. There is no configuration setting. Service Workbench creates a new account in the AWS Organizations for this deployment, named after the stage name used at deployment.


### Deploy the prepare master account SDC

To deploy the `prepare_master_acc` SDC, perform the following: 
 
1. Read the file: `main/solution/prepare-master-acc/README.md`.  
2. Deploy the orhanizational account SDC from the directory,  `main/solution/prepare-master-acc`:

```{.sh}
    pnpx sls deploy --stage <stage>
```

3. To display the ARN of the organizational role from the same directory:

```{.sh}
    pnpx sls info --verbose --stage <stage>
```

The organizational role ARN will be needed when adding accounts within Service Workbench.

_**Note**: Running the convenience script `scripts/master-account-deploy.sh <stage>` will perform the same steps as `pnpx sls deploy`, above._

### Confirm the creation of organizational role

The newly-created role will contain the String **MasterRole**. It has two policies and trusts the main account. 

<img src={useBaseUrl('img/deployment/post_deployment/prepare_master_account_0.jpg')} />

_**Figure: Permissions policies**_

<img src={useBaseUrl('img/deployment/post_deployment/prepare_master_account_1.jpg')} />

_**Figure: Edit trust relationships**_



