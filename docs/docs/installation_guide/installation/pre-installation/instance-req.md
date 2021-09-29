---
id: instance-req
title: Instance requirements
sidebar_label: Instance requirements
---


import useBaseUrl from '@docusaurus/useBaseUrl';

| Section      | Description |
| ----------- | ----------- |
| [Creating an EC2 instance](#createinst)      | Provides information on selecting the EC2 instance size for Service Workbench installation.      |
| [Configuring an EC2 instance](#confinst)  | Describes the procedure of configuring an EC2 instance, creating an IAM role, and assigning the administrator role to the EC2 instance.              |
| [Installing the required software on EC2 instance](#install)   | Describes the commands to clone Git directory that contains Service Workbench installation.       |


### Creating an EC2 instance

<a name="createinst"></a>

You can create an EC2 instance with the following specifications:

+ Amazon EC2 instance type: Use a `T2.medium` Amazon EC2 instance or larger. Larger machines have faster networking and larger disks have higher performance. 

**Important**: 40 GB is the suggested disk drive size needed for installation.

+ VPC and subnets: Use the default VPC and subnet.
+ AWS IAM role: Attach it to your instance an AWS IAM role with sufficient permission, such as the administrator access. 

### Configuring an EC2 instance

<a name="confinst"></a>

An Amazon EC2 instance can be assigned an instance profile that contains an AWS IAM role. The AWS IAM role gives the Amazon EC2 instance a set of permissions. The Amazon EC2 instance performs the actions defined by its AWS IAM role. Adding an AWS IAM role to the Amazon EC2 instance allows your application to make API calls securely—reducing the need to manage security credentials.
The Service Workbench deployment application must be able to create AWS resources. The easiest way to meet this requirement is to give the Amazon EC2 instance an administrator role.

#### Creating a new IAM role


When creating a new Amazon EC2 instance, an instance profile may be assigned to the Amazon EC2 instance. 

1. Choose **Create a new IAM role** located next to the AWS IAM role drop-down.  To continue the process, highlight Amazon EC2 and proceed to permissions.

<img src={useBaseUrl('img/deployment/installation/iam1.png')} />

2. For **Permissions**, choose **AdministratorAccess** from the filter and proceed through **tags**.

<img src={useBaseUrl('img/deployment/installation/iam2.png')} />

3. In the **Review** page, enter the role name.
 
<img src={useBaseUrl('img/deployment/installation/iam3.png')} />

4. Return to the **Amazon EC2** tab, refresh the **IAM role** drop-down, and choose your administrator role to attach to the new Amazon EC2 instance. 

<img src={useBaseUrl('img/deployment/installation/iam4.png')} />

5. Create the Amazon EC2 instance.

#### Adding a role to an existing instance

To add a role to an Amazon EC2 instance that is already running:

1. Select the Amazon EC2 instance in the EC2 console. 
2. On the **Actions** menu, choose **Instance Settings, Attach/Replace IAM Role**. 
3. In the **Attach/Replace IAM Role** screen, select the role you created and choose **Apply**.
 
### Installing the required software on EC2 instance

<a name="install"></a>

1. Install prerequisite software (serverless and pnpm) for installing Service Workbench on AWS on the EC2 instance:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.bashrc
nvm install 12
npm install -g serverless pnpm hygen
```

2. Run the following command to display the version of the serverless package:

`serverless –v`
