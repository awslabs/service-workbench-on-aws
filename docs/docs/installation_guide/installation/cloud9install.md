---
id: cloud9install
title: Installing Service Workbench using Cloud9
sidebar_label: Installing using Cloud9
---


You can install Service Workbench by using AWS Cloud9. This section provides information about the installation procedure for Service Workbench using AWS Cloud9 IDE.

| Section      | Description |
| ----------- | ----------- |
| [Creating AWS Cloud9 instance](#createinst)      | Describes the steps to create an AWS Cloud9 instance that will be used for Service Workbench installation.      |
| [Modifying the volume](#modifyvol)  | Describes the steps to modify the volume size.        |
| [Increasing the partition](#partition)      | Describes the commands to increase the partition size for Service Workbench installation.       |
| [Installing Node Package Manager](#npm)   | Describes the commands to install Node Package Manager.        |
| [Cloning the Git directory](#git)   | Describes the commands to clone Git directory that contains Service Workbench installation.       |
| [Making a copy of the environment file](#env)      | Describes the steps to make a copy of the environment file and make required settings inside the file for Service Workbench installation.       |
| [Running the script to install Service Workbench](#script)   | Describes the steps to install Service Workbench.        |


### Creating AWS Cloud9 instance

<a name="createinst"></a>

1. Go to the AWS Cloud9 product page.
2. Choose the **Create environment** button.
3. Enter the name and description for the AWS Cloud9 environment. 
4. Choose **Next step**.
5. For **Instance type**, choose **m5.large (8 GiB + 2 vCPU)**.
6. For **Platform**, choose **Amazon Linux 2**. 
7. Choose **Next step**. 
8. Review all the changes and choose **Create environment**.

### Modifying the volume

<a name="modifyvol"></a>

1. Go the AWS Cloud9 instance in EC2.
2. For **Actions**, choose **Modify Volume**.
3. For **Size**, enter 40. 40 GB is the minimum suggested volume size needed for installation.
4. Choose **Modify**.
5. Choose **Yes** to accept the changes. Refresh your screen to view the modified volume size. In the Linux prompt, type the following to view the disk space:
     `df –hT`

### Increasing the partition

<a name="partition"></a>

To increase the partition size, type the following command:

`sudo growpart /dev/nvme0n1 1`

Increase the file system inside the partition

`sudo xfs_growfs –d /`

For more information on partitioning, read [Moving an environment and resizing/encrypting Amazon EBS volumes](https://docs.aws.amazon.com/cloud9/latest/user-guide/move-environment.html#move-environment-resize)

#### Verifying the file size

To verify the file size, type:
`df –hT`
#### Check the node version installed

Type `node --version`
To install long-term support version, type:
`nvm install lts/erbium`

### Installing Node Package Manager

<a name="npm"></a>

`npm install –g pnpm`
#### Verify the Go version

`go version`

**Note**: Install everything in one directory.

### Cloning the Git directory
<a name="git"></a>

`git clone https://github.com/awslabs/service-workbench-on-aws.git`

### Making a copy of the environment file

1.<a name="env"></a> In the file explorer, choose `example.yml`.

2. Copy this file and create a new version. Example, `dev.yml`.

3. Uncomment the following in `dev.yml`:<br />
     + `awsRegion: us-east-1`<br />
     + `solutionName: sw`<br />
     + `envType: dev`<br />
     + `createServiceCatalogPortfolio: true`<br />

4.Save `dev.yml`.<br />

### Running the script to install Service Workbench

<a name="script"></a>

`scripts/environment-deploy.sh <stage>`
Example: scripts/environment-deploy.sh dev

### Copying CloudFront URL details

Once the installation completes, the following details are displayed on your screen. Note the website URL and the root password. You can use this URL and password to sign in to Service Workbench.