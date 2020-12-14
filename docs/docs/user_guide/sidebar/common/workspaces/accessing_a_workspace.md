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
The selected studies will show up as mounted directories in the Jupyter notebook running on the workspace (EMR or SageMaker).
These study directories will contain files uploaded to the corresponding study. 
Any files uploaded to the study from the Service Workbench will automatically appear in the mounted study directories 
after a short delay.

> Note: the password for EMR instance is 'go-research-on-aws'

### Connect to EC2 Linux

1. Click the connections button shown in EC2 Linux instance
2. Click Create Key button, download the key file (This is the only chance to download the key file)
3. Save the key file locally and run `chmod 600` to restrict access to the key file
4. Click ‘Use this SSH Key’ button and follow the instructions to link to EC2 instance
5. If the 60 seconds count down on the page times out, simply click ‘Use this SSH Key’ button again and continue
6. SSH to the EC2 Linux machine using the command shown on the screen. Note that you may need to adjust the path of the private key on your local machine.
7. Once you SSH, the selected studies will show up as mounted directories on the EC2 Linux instance. These study directories will contain files uploaded to the corresponding study. Any files uploaded to the study from the Service Workbench will automatically appear in the mounted study directories after a short delay.

### Connect to EC2 Windows

Click the connections button, follow the instruction to link to the instance using a local RDP client.

> Note: A warning message may pop up for EC2 certificate. This is a normal behavior as the EC2 Windows instance has self
> signed SSL cert. Click continue to get connected.

Once you RDP, the selected studies will show up as directories on the EC2 Windows instance in "D" drive. 
These study directories will contain files uploaded to the corresponding study.

For EC2 Windows, the selected study data is copied to the attached EBS volumes as opposed to being FUSE mounted in case of other workspace types.
If the selected study is writeable, the local changes are synchronized back to S3 as soon as possible.

It uses a custom S3 Synchronizer tool (i.e., `c:\workdir\s3-synchronizer.exe`) tool to sync changes from S3 to local EBS volumes and vice versa.
   
Please be aware of the following limitations specific to EC2 Windows Workspace Types:

**LIMITATIONS:**

**S3 to Local Sync Limitations:**
- If the selected study is Read-Only, any changes made under the locally mapped study directory and it's subdirectories will be **LOST** after the periodic sync. No local changes will persist.
- There will be delay of at least the duration equal to the periodic download interval plus the download time for the S3 changes to reflect on local EBS volumes.
- Deleting a subdirectory in studies S3 location will leave the corresponding subdirectory as empty directory on local EBS volume. 

**Local to S3 Sync Limitations:**
- Will not upload changes from local to S3 if there is no change in file size (bytes)
- Will not upload changes from local to S3 if the file is empty (i.e., zero bytes)
- **Conflict resolution is undefined:** i.e., if a file is modified in S3 and locally at the same time, the behavior is undefined. Whichever change gets synchronized first may win.

**S3 Synchronizer tool:**
- The synchronizer is automatically started when the EC2 Windows instance is launched
- You can check if S3 Synchronizer tool is running or not by looking for `s3-synchronizer.exe` in Windows Task Manager
- **Stopping:** To stop the synchronizer, right click on the `s3-synchronizer.exe` in Windows Task Manager and select `End task`
- **Starting:** To start the synchronizer, run the powershell script `c:\workdir\start-s3-synchronizer.ps1` (right click, select `Run with Powershell`).
- **Troubleshooting:** View log files `c:\workdir\s3-synchronizer-stderr.txt` and `c:\workdir\s3-synchronizer-stdout.txt` 

### Connect to RStudio

Since RStudio currently requires a custom domain name, please configure the same by following the steps in `main/solution/machine-images/README.md`.

1. The EC2 instance backing this workspace must be in the **Ready** state. Also make sure its security group allows your IP HTTPS access to it.
2. Click on the connections button and hit **Connect**.
3. The selected studies will show up as mounted directories in the RStudio. These study directories will contain files uploaded to the corresponding study. Any files uploaded to the study from the Service Workbench will automatically appear in the mounted study directories after a short delay.

> Notes:
>
> 1. If you're provisioning an RStudio instance with studies selected, these studies will only get mounted on your instance once you click on the RStudio workspace's "Terminal" tab.
> 2. If you started a previously stopped RStudio instance (manually or automatically) and connect to it, you might see an error dialog box saying the session closed abruptly. Although this typically does not affect your data, it is recommended to quit your session from within your RStudio workspace before stopping the instance through SWB.
> 3. The auto-stop feature is enabled by default and configured to 1 hour. For configuring a different auto-stop timeout, please assign the MAX_IDLE_MINUTES value accordingly in `main/solution/machine-images/config/infra/files/rstudio/check-idle` and redeploy the machine-images SDC.
> 4. To disable auto-stop, assign the value 0 to MAX_IDLE_MINUTES and redploy machine-images SDC.

### Start and Stop workspace

EC2 Windows, EC2 Linux, RStudio and SageMaker workspaces can be stopped when not in use. Click the stop button to stop the workspace, and click the start button to start the workspace again. 

### Common connection issues

Connection to workspace is restricted to specific CIDR block.

- Check if your public IP is covered by the restricted CIDR block of the workspace.
- Check if workspace type configuration has hard-coded value in field 'AccessFromCIDRBlock'. (Admin only)
- If you're using VPN, your public IP address might change. Try disconnect VPN, and then connect to workspace.
