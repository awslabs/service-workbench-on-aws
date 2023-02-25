---
id: ami-install
title: Installing AMIs
sidebar_label: Installing AMIs
---

import useBaseUrl from '@docusaurus/useBaseUrl';

You can install Service Workbench either by creating and configuring an EC2 instance or by creating a Cloud9 instance. This section describes the steps to install Service Workbench by using either of the two options.

### Installing AMIs for EC2 Workspace

In order to use EC2-based Workspaces, you must ﬁrst install EC2 AMIs for these Workspaces. 

This process may be run in parallel while `environment-deploy.sh` is running. To run both simultaneously, open another SSH or SSM session to your EC2 instance.

Pre-requisites:
1. Ensure packer tool is installed in your environment. If required, use the following instructions to install packer.
     + Install packer from the root of your home directory:     
           `wget https://releases.hashicorp.com/packer/1.6.2/packer_1.6.2_linux_amd64.zip`    
           `unzip packer_1.6.2_linux_amd64.zip`     
     For more information about packer installation, refer to the [README](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/addons/addon-base-raas/packages/serverless-packer/README.md#topics).
      
     
Build AMIs for EC2-based workspaces: 
1. Change to the directory `/service-workbench-on-aws/main/solutions/machine-images`:. Ensure that the environment variable `STAGE_NAME` has been set (or) replace `${STAGE_NAME}` with your stage file name without the extension. 
2. Run the following command to start building AMIs

      `pnpx sls build-image -s ${STAGE_NAME}`

      Example: 
      
      `pnpx sls build-image -s dev`

2. Verify that the AMIs have been created by going to Amazon EC2 service console, select AMI in the left-hand navigation. You should see AMIs for EC2-LINUX, EC2-RSTUDIO, EC2-WINDOWS, and Amazon EMR.  

<img src={useBaseUrl('../../../static/img/deployment/installation/AMI.png')} />

**Warning**: Each time the above command is run, a new set of AMIs will be created.
