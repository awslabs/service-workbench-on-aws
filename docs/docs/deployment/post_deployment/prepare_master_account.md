---
id: prepare_master_account
title: Prepare the Master Account
sidebar_label: Prepare the Master Account
---
import useBaseUrl from '@docusaurus/useBaseUrl';

## Prepare the Master Account

This step is only required if Service Workbench is to be used to vend accounts in the AWS Organization, using the 'Create Account' mechanism.  If Service Workbench is to use only billing accounts imported through the 'Add Account' mechanism, this step can be omitted.

In this step we will deploy the **prepare_master_acc** SDC in the directory `main/solution/prepare-master-acc`.  This will create in the Master account a role that allows AssumeRole, and has the Main account as its trusted entity.  If you have deployed Service Workbench in a Master account, the Main account is also the Master account, and the trusted entity will be the same account ID as the Master account.  If you have deployed Service Workbench in a Member account, the Main account is the Member account, and the trusted entity (the Member account) will be a different account ID than the Master account.

The default settings in this step are:
* Main Account ID: The current AWS Account ID
* External ID: The string **workbench**

These defaults are sufficient if you are deploying Service Workbench from the Master account, and the default profile has permissions for the Master account, since the Main account is also the Master account.  If deploying Service Workbench in a Member account, you must create a configuration file to specify the Main account ID and the Profile to use.  This profile must have permissions for the Master account.

### Create a Configuration File

If deploying Service Workbench in an account other than that accessed by the current default profile, create a stage-named configuration file in the directory `main/solution/prepare-master-acc/config/settings` by copying `example.yml` to `<stage>.yml`.  Edit the file as appropriate:
* **awsProfile**: The AWS Credentials profile with permissions for the Master account.
* **mainAccountID**: The 12 digit AWS Account ID for the Main AWS account, where the solution is deployed.
* **externalId**: As desired.  The string **workbench** is often used.  This string will be needed when creating an AWS account within Service Workbench.

### Deploy the Prepare Master Account SDC

Read `main/solution/prepare-master-acc/README.md`

Deploy the Master Account SDC from the directory  `main/solution/prepare-master-acc`:

```{.sh}
    pnpx sls deploy --stage <stage>
```

To display the ARN of the Master Role, from the same directory:

```{.sh}
    pnpx sls info --verbose --stage <stage>
```

The Master Role ARN will be needed when adding accounts within Service Workbench.

(Note: Running the convenience script `scripts/master-account-deploy.sh <stage>` will perform the same steps as `pnpx sls deploy`, above)

### Master Role

The newly-created role will contain the String **MasterRole**, will have two policies, and will trust the Main account:

<img src={useBaseUrl('img/deployment/post_deployment/prepare_master_account_0.jpg')} />

<img src={useBaseUrl('img/deployment/post_deployment/prepare_master_account_1.jpg')} />
