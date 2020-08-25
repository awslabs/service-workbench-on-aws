---
id: iam_role
title: Add an IAM role to an instance
sidebar_label: Add an IAM role to an instance
---

import useBaseUrl from '@docusaurus/useBaseUrl';

An EC2 instance can be assigned an Instance Profile which contains a
role. All actions from this instance are then performed with the
permissions given by the role. In this way you can allow your
application to make API calls securely, without having to manage
security credentials.

We require that the Service Workbench deployment application be able to create AWS
resources. The easiest way to do this is to give our EC2 instance an
administrator role.

## Adding a role to a new instance

When creating a new instance from which to deploy Service Workbench, an instance
profile may be assigned to the instance in Step 3: Configure Instance
Details. Click \'Create a new IAM role\' next to the IAM role drop-down.

<img src={useBaseUrl('img/deployment/reference/iam_00.jpg')} />

In IAM, click \'Create role\'

<img src={useBaseUrl('img/deployment/reference/iam_01.jpg')} />

Highlight EC2 and proceed to Permissions

<img src={useBaseUrl('img/deployment/reference/iam_02.jpg')} />

In Permissions, filter for and select **AdministratorAccess**

<img src={useBaseUrl('img/deployment/reference/iam_03.jpg')} />

Proceed through Tags and in the Review page, give your role a memorable
name.

<img src={useBaseUrl('img/deployment/reference/iam_04.jpg')} />

Go back to the EC2 tab, refresh the IAM role dropdown and select your
administrator role to attach to the new instance.

<img src={useBaseUrl('img/deployment/reference/iam_05.jpg')} />

Now proceed through to creation of the instance.

## Adding a role to an existing instance

To add a role to an instance that is already running, select the
instance in the EC2 console, open the **Action** -\> **Instance
Settings** menu, and select \'Attach/Replace IAM Role\'.

<img src={useBaseUrl('img/deployment/reference/iam_06.jpg')} />

In the \'Attach/Replace IAM Role\' screen, search for and select the
role to apply, and click **Apply**.

<img src={useBaseUrl('img/deployment/reference/iam_07.jpg')} />
