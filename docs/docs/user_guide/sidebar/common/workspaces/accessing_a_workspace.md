---
id: accessing_a_workspace
title: Accessing a Workspace
sidebar_label: Accessing a Workspace
---

You can connect to Workspaces that you have access to. To access a Workspace, follow these steps:

In the portal navigate to the **Workspaces** page using the menu on the left.
In the list of Workspaces, find the Workspace that you want to connect to.

### Connect to SageMaker and EMR worksapce

Click on the **Connect** button, the Workspace must be in the **Ready** state to access it.

> Note: the password for EMR instance is 'go-research-on-aws'

### Connect to EC2 Linux

1. Click the connections button shown in EC2 Linux instance
2. Click Create Key button, download the key file (This is the only chance to download the key file)
3. Save the key file locally and run `chmod 600` to restrict access to the key file
4. Click ‘Use this SSH Key’ button and follow the instructions to link to EC2 instance
5. If the 60 seconds count down on the page times out, simply click ‘Use this SSH Key’ button again and continue

### Connect to EC2 Windows

Click the connections button, follow the instruction to link to the instance using a local RDP client.

> Note: A warning message may pop up for EC2 certificate. This is a normal behavior as the EC2 Windows instance has self
> signed SSL cert. Click continue to get connected.

### Connect to RStudio

Since RStudio currently requires a custom domain name, please configure the same by following the steps in `main/solution/machine-images/README.md`.

1. The EC2 instance backing this workspace must be in the **Ready** state. Also make sure its security group allows your IP HTTPS access to it.
2. Click on the connections button and hit **Connect**.

> Note: If your EC2 instance, which is backing RStudio, goes through a reboot (manual or automatic), it’s public DNS might change and would need to be updated manually in the Hosted Zone’s corresponding CNAME record.

### Common connection issues

Connection to workspace is restricted to specific CIDR block.

- Check if your public IP is covered by the restricted CIDR block of the workspace.
- Check if workspace type configuration has hard-coded value in field 'AccessFromCIDRBlock'. (Admin only)
- If you're using VPN, your public IP address might change. Try disconnect VPN, and then connect to workspace.
