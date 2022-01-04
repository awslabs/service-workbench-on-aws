---
id: commandline
title: Upgrade process for command-line installations
sidebar_label: Upgrade process for command line installations
---

You can upgrade Service Workbench deployments that were installed from the command line using downloaded source code. 

### Prerequisites

- Access to the account where Service Workbench is installed.
- An EC2 deployment instance to be used in this account.
- The latest source code.
- Configuration files matching those used in the original deployment.

### Accessing the account

Similarly to an initial installation, it is easy to perform an upgrade from an EC2 instance. To do this, use an instance role giving access to the Service Workbench account.  To set up an instance and install the prerequisite software, see pre-installation steps.

Log in to the instance and test access to the account by listing the S3 buckets:
`aws s3 ls`
Seven buckets with similar name stems are displayed.  The name stem includes several values needed later in the configuration files. They have the following format:
 `<account>-<stage>-<region>-<solution>-<purpose>`  
For example, the bucket `012345678901-demo-va-sw-studydata` is in account `012345678901`, stage name `demo`, Region code `va (us-east-1)`, solution name `sw`, and it hosts the study data.

### Downloading source code

On the deployment instance, verify if there is a directory named `service-workbench-on-aws`, from the initial deployment.  If yes, either rename it or move it into a subdirectory before downloading the source code. This prevents name duplication.

Download the latest source code from GitHub using git clone, as described in Installing Service Workbench. 

When upgrading Service Workbench, refer to the [CHANGELOG](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/CHANGELOG.md) for additional steps that might be required for the upgraded version.

### Setting the configuration

Follow the steps in Configuration settings, where the name of the file comes from the stage name in the bucket name stem.  In the configuration file, configure the settings:

- `awsRegion`: Refer to the [Regional code mapping](/installation_guide/uninstall) section to verify the full region name for the region code. For example, set awsRegion: us-east-1 for the region code va.
- `solutionName`: Use the solution name from the bucket name stem (for example: solutionName: sw)
Upgrading Service Workbench

After creating the configuration file, run the main deployment script as described in Installing Service Workbench.

In the main Service Workbench directory,

`./scripts/environment-deploy.sh ${STAGE_NAME}`

After the upgrade, update each account in Service Workbench as described in the [Post upgrade](/installation_guide/postupgrade) section.