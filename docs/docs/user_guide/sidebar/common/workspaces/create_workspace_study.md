---
id: create_workspace_study
title: Creating a new Workspace
sidebar_label: Creating a Workspace
---

A user can select a Study or multiple Studies and launch a Workspace to access and analyze that data. To launch a Workspace, follow these steps:

1. In the portal navigate to the **Studies** page using the menu on the left.
2. Select the Studies to be attached to the new Workspace.
   1. Note: If the Study is in a *Pending* or *Error* state, there may be a permissions issue with the AWS account hosting the data. You will not be able to select the Study. Contact your administrator.
3. Once you have selected all the Studies you want, click the **Next** button.
4. Choose the type of Workspace you want and click the **Next** button.
5. Type a name for the Workspace in the **Name** field.
6. Select a project that this Workspace will belong to in the **Project ID** drop down field.
7. Select the **Configuration** type.
8. Type a description for the Workspace in the **Description** field.
9. Click the **Create Research Workspace** button.

This will deploy the new Workspace and attach the Studies that were selected. You will automatically be redirected to the Workspaces tab on the portal.

:::note
If you are deploying an EMR, EC2 - Linux or EC2 - Windows based Workspace, you will also be asked to provide a **Whitelisted CIDR**.

Your current IP address is automatically detected as x.x.x.x/32.

This will be used to configure the Security Group associated with this instance enabling you to get access.
:::

:::tip
It is recommended that you limit the Whitelisted CIDR range to only the IP addresses that need to access the Workspace.
:::
