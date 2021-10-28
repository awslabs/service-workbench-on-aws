---
id: iam_role
title: Reference
sidebar_label: Add an AWS IAM role to an Amazon EC2 instance
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Service Workbench on AWS interacts with multiple AWS resources, including Amazon EC2, AWS IAM, AWS Organizations, and more. You can easily add an AWS IAM role to an Amazon EC2 instance, leverage our AWS Organizations with your account structure, and create multiple Amazon S3 buckets. 

## Adding an AWS IAM role to an Amazon EC2 instance

An Amazon EC2 instance can be assigned an instance profile that contains an AWS IAM role. The AWS IAM role gives the Amazon EC2 instance a set of permissions. The Amazon EC2 instance only performs the actions defined by its AWS IAM role. Adding an AWS IAM role to the Amazon EC2 instance allows your application to make API calls securely—eliminating the need to manage security credentials.

The Service Workbench deployment application must be able to create AWS resources. The easiest way to meet this requirement is to give the Amazon EC2 instance an administrator role.

### Adding an administrator role to a new Amazon EC2 instance

When creating a new Amazon EC2 instance for a Service Workbench deployment, an instance profile may be assigned to the Amazon EC2 instance. Choose **Create a new IAM role** located next to the AWS IAM role drop-down. The following figures display an image of the Create a New IAM role action in the AWS Management Console. 

<img src={useBaseUrl('img/deployment/reference/iam_00.jpg')} />
<img src={useBaseUrl('img/deployment/reference/iam_01.jpg')} />

***Figure 25: Create a new AWS IAM role***

To continue the process, highlight Amazon EC2 and proceed to permissions. 
1. In ‘**Permissions**’, filter for ‘**AdministratorAccess**’ and select it. 

<img src={useBaseUrl('img/deployment/reference/iam_02.jpg')} />

***Figure: Permissions in Amazon EC2 instance***

<img src={useBaseUrl('img/deployment/reference/iam_03.jpg')} />

***Figure: Filtering for administrator's access***

2. Proceed through ‘**Tags**’. 
3. On the ‘**Review**’ page, enter the role name. 

<img src={useBaseUrl('img/deployment/reference/iam_04.jpg')} />

***Figure: Choosing a role name for an Amazon EC2 instance***

4. In the Amazon EC2 tab, refresh the AWS IAM role drop-down, and choose the administrator role that is to be attached to the new Amazon EC2 instance.  

<img src={useBaseUrl('img/deployment/reference/iam_05.jpg')} />

***Figure: Selecting the administrator role of the Amazon EC2 instance***

5. Create an Amazon EC2 instance. 

### Adding a role to an existing instance

To add a role to an Amazon EC2 instance that is already running, select the Amazon EC2 instance in the EC2 Console. Open the **Action > Instance Settings** menu, and select **Attach/Replace IAM Role**. The following figure shows the **Instance Settings** menu.

<img src={useBaseUrl('img/deployment/reference/iam_06.jpg')} />

***Figure: Attach/Replace an AWS IAM Role in the EC2 Console***

In the **Attach/Replace IAM Role** screen, search for the role you created, select it, and choose **Apply**. The following figure shows the screen where you can attach/replace an IAM role. 	 

<img src={useBaseUrl('img/deployment/reference/iam_07.jpg')} />

***Figure: AWS IAM role search***
