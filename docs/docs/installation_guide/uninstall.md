---
id: uninstall
title: Uninstalling Service Workbench
sidebar_label: Uninstalling Service Workbench
---

Follow these guidelines to delete the following for uninstalling Service Workbench:

**CloudFormation stack**

+ For Workspaces that are running, manually delete the PVRE role additions before the stack is successfully deleted.
+ Empty every bucket before deleting the stack.
+ The artifacts bucket has to be deleted manually.

**Products from AWS Service Catalog**

+ Select the portfolio, remove each product, delete the entries in groups, roles and users, and then delete the portfolio.
+ Go to **Products** and delete the products from the list.
AMIs and snapshots
+ Go to EC2 console, select AMIs in the left-hand menu, choose all AMIs (from SWB) and then choose **Deregister**.
+ Select all snapshots and choose **Delete**.

**Lambda functions**

Delete Service Workbench-related Lambda functions.

**CloudWatch log groups**

Go to CloudWatch console, then select and delete the log groups. Alternatively, set the retention and the log groups will be deleted automatically.

**AWS Cloud9 IDE**

If you used AWS Cloud9 to deploy Service Workbench, you can delete this environment.

**Using the uninstall script**

Use the following script to uninstall Service Workbench:

```
https://github.com/awslabs/service-workbench-on-aws/blob/mainline/scripts/environment-delete.sh 
```


**Regional code mapping**

Region code mapping is defined in the `main/config/settings/.defaults.yml` file.

```'us-east-2': 'oh'
'us-east-1': 'va'
'us-west-1': 'ca'
'us-west-2': 'or'
'ap-east-1': 'hk'
'ap-south-1': 'mum'
'ap-northeast-3': 'osa'
'ap-northeast-2': 'sel'
'ap-southeast-1': 'sg'
'ap-southeast-2': 'syd'
'ap-northeast-1': 'ty'
'ca-central-1': 'ca'
'cn-north-1': 'cn'
'cn-northwest-1': 'nx'
'eu-central-1': 'fr'
'eu-west-1': 'irl'
'eu-west-2': 'ldn'
'eu-west-3': 'par'
'eu-north-1': 'sth'
'me-south-1': 'bhr'
'sa-east-1': 'sao'
'us-gov-east-1': 'gce'
'us-gov-west-1': 'gcw'
```
