---
id: iam_role
title: Reference
sidebar_label: Add an AWS IAM role to an Amazon EC2 instance
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Service Workbench on AWS interacts with multiple AWS resources, including Amazon EC2, AWS IAM, AWS Organizations, and more. You can easily add an AWS IAM role to an Amazon EC2 instance, leverage our AWS Organizations with your account structure, and create multiple Amazon S3 buckets. 

## Add an AWS IAM Role to an Amazon EC2 Instance

An Amazon EC2 instance can be assigned an **Instance Profile** that contains an AWS **IAM role**. The AWS **IAM role** will give the Amazon EC2 instance a set of permissions. The Amazon EC2 instance will only perform the actions defined by its AWS **IAM role**. Adding an AWS **IAM role** to the Amazon EC2 instance allows your application to make API calls securely—eliminating the need to manage security credentials.

The Service Workbench deployment application must be able to create AWS resources. The easiest way to meet this requirement is to give the Amazon EC2 instance an administrator role.

### Adding an Administrator Role to a New Amazon EC2 Instance

When creating a new Amazon EC2 instance for a Service Workbench deployment, an **Instance Profile** may be assigned to the Amazon EC2 instance in ‘**Step 3: Configure Instance Details**’. Select ‘**Create a new IAM role**'—located next to the AWS IAM role drop-down. **Figure 25** displays an image of the ‘**Create a New IAM**’ role action in the AWS Management Console. 

<img src={useBaseUrl('img/deployment/reference/iam_00.jpg')} />
<img src={useBaseUrl('img/deployment/reference/iam_01.jpg')} />

***Figure 25: Create a New AWS IAM Role***

To continue the process, highlight Amazon EC2 and proceed to permissions. In ‘**Permissions**’, filter for ‘**AdministratorAccess**’ and select it. Proceed through ‘**Tags**’. On the ‘**Review**’ page, give your role a memorable name. Return to the Amazon EC2 tab, refresh the AWS IAM role drop-down, and select your administrator role to attach to the new Amazon EC2 instance. Now, proceed through the process to create an Amazon EC2 instance. **Figure 26**, **Figure 27**, **Figure 28**, and **Figure 29** display images to help you complete this process. 

<img src={useBaseUrl('img/deployment/reference/iam_02.jpg')} />

***Figure 26: Permissions in Amazon EC2***

<img src={useBaseUrl('img/deployment/reference/iam_03.jpg')} />

***Figure 27: Filtering for AdministratorAccess***

<img src={useBaseUrl('img/deployment/reference/iam_04.jpg')} />

***Figure 28: Choosing a Role Name for an Amazon EC2 Instance***

<img src={useBaseUrl('img/deployment/reference/iam_05.jpg')} />

***Figure 29: Selecting the Administrator Role of the Amazon EC2 Instance***

### Adding a role to an existing instance

To add a role to an Amazon EC2 instance that is already running, select the Amazon EC2 instance in the EC2 Console. Open the ‘**Action > Instance Settings**’ menu, and select ‘**Attach/Replace IAM Role**’. **Figure 30** shows the **Instance Settings** menu.

<img src={useBaseUrl('img/deployment/reference/iam_06.jpg')} />

***Figure 30: Attach/Replace an AWS IAM Role in the EC2 Console***

In the ‘**Attach/Replace IAM Role**’ screen, search for the role you created, select it, and click **Apply**. **Figure 31** shows the screen where you can ‘**Attach/Replace IAM Role**’. 	 

<img src={useBaseUrl('img/deployment/reference/iam_07.jpg')} />

***Figure 31: AWS IAM Role Search***
