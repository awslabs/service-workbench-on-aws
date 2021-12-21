---
id: import_service_catalog_products
title: Import AWS Service Catalog products
sidebar_label: Import AWS Service Catalog products
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Service Workbench uses [AWS Service Catalog](https://aws.amazon.com/servicecatalog/?aws-service-catalog.sort-by=item.additionalFields.createdDate&aws-service-catalog.sort-order=desc)
to manage different types of computation resources available for researchers to use through the platform.

With AWS Service Catalog integration, Service Workbench allows admin users to create and manage catalogs of IT services that are approved for use on AWS. These IT services can include everything from virtual machine images, servers, software, and databases to complete multi-tier application architectures.

With this integration, Service Workbench helps organization to centrally manage commonly deployed IT services, and helps achieve consistent governance and meet compliance requirements, while enabling users to quickly deploy only the approved IT services they need.

When Service Workbench is deployed, an AWS Service Catalog portfolio is created by default with four commonly used products: Amazon SageMaker, Amazon EC2 for Windows, Amazon EC2 for Linux and Amazon EMR. The administrator needs to import and configure these products using Service Workbench user interface before they can be deployed. If you want to include additional custom products in the AWS Service Catalog portfolio, complete these steps: 

1.	Add the AWS CloudFormation template in the following directory:
`addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/service-catalog`
2.	Add the AWS CloudFormation template file name in the productsToCreate list in the following location: 
`addons/addon-base-raas/packages/base-raas-post-deployment/lib/steps/create-service-catalog-portfolio.js`
3.	Deploy Service Workbench.

Note: If products are updated directly in Service Catalog in the AWS Management console, then their automatic version updates via Service Workbench are not guaranteed anymore.

## Import a Product

In this step, you import a pre-defined product, configure parameters to be used for product launch, and approve the configured product to be used. The following sections use Amazon EC2 Linux as an example, followed by setting different configuration required for Amazon EC2 Windows, Amazon SageMaker and Amazon EMR.

### Prerequisites

Ensure the following prerequisites are met in order to import a product. 

#### Creating AMI

Make sure you completed the step, [Deploy the Machine Images SDC](/deployment/deployment/index#deploy-the-machine-images-sdc)
as part of the deployment process. 

To check if AMIs were created successfully: 

1. Navigate to Amazon EC2. 
2. Choose the AMI tab. 
3. Note down the four AMIs created for Amazon EC2 Linux, Amazon EC2 Windows, Amazon EMR, and Amazon EC2 RStudio. 
4.	Copy the AMI IDs and use for workspace import and configuration. Alternatively, you can also copy these AMI IDs from the terminal when the machine-images SDC is deployed.

**Note**: If you run the machine images SDC multiple times, duplicated AMIs are created. This is okay and will not affect any Service Workbench functionalities. You can choose to remove the duplicates to avoid confusion or leave them.


#### Viewing Service Catalog Portfolio

1. Log in to Service Workbench UI as an **administrator**.
2. Navigate to ‘**Workspace Types**’ tab. Four AWS Service Catalog Products display as shown below.

<img src={useBaseUrl('img/deployment/post_deployment/service_catalog_import_00.png')} />

***Figure: AWS Service Catalog Products***

These four products come from the AWS Service Catalog portfolio created by the system during deployment. And they'll be ready for use once imported and configured.

If you wish to include other AWS computation resources in the future: 

1. Add a new product to the existing Service Workbench portfolio in AWS Service Catalog
2. Update the role `ServiceCatalogLaunchConstraintRole` in [cloudformation.yml](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/solution/post-deployment/config/infra/cloudformation.yml#L204) to include permission needed to launch and terminate the product

### Importing a workspace

In this section, the Amazon EC2 Linux is used as an example.

1. Choose '**Import**' under `ec2-linux-instance`. 
2. Enter the **Name** and **Description** so you can easily identify the workspace.

### Configuring the workspace

Once you import a workspace type, perform the following actions: 

1. Choose '**Add Configuration**'
2. Enter the **ID**, **Name**, **Description**, and **Estimated Costs** for the configuration. A common naming convention here is to attach the instance size after the product name. For example, use `ec2-linux-instance-V1-small` for a small Linux Amazon EC2 instance. 
3. Choose ‘**Next**’.
4. Enter access control for the workspace configuration.
5. Enter '**Next**'.

The input parameters are parameters used for the product, AWS CloudFormation template. The number and type of parameters are different for different products. Most of the parameters used for the four system created products can be evaluated automatically at launch time. These parameters are available for selection in the drop-down when filling the input parameters page.

### Configuration for EC2 Linux

For Amazon EC2 Linux, the only two fields that are not available in the drop-down are **InstanceType** and **AmiId**.

The following figures display screenshot images that exemplify Amazon EC2 Linux configurations.

<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_linux_00.png')} />

***Figure: Configurations for Amazon EC2 Linux***

<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_linux_01.png')} />

***Figure: Configurations for Amazon Linux EC2***

### Configuration for Amazon EC2 Windows

For Amazon EC2 Windows, the only two fields that are not available in the drop-down are ‘**InstanceType**’ and ‘**AmiId**’. (Use the AMI ID you copied in Prerequisites - AMI)

The following figures display screenshot images that exemplify Amazon EC2 Windows configurations.

<img src={useBaseUrl('img/deployment/post_deployment/SWB_param1.png')} />

***Figure: Configurations for EC2 Windows*** 

<img src={useBaseUrl('img/deployment/post_deployment/SWB_param2.png')} />

***Figure: Configurations for EC2 Windows***

<img src={useBaseUrl('img/deployment/post_deployment/SWB_param3.png')} />

***Figure: Configurations for EC2 Windows*** 

### Configuration for Amazon SageMaker

For Amazon SageMaker, the only field that’s not available in the drop-down is ‘**InstanceType**’.

The following figures display screenshot images that exemplify Amazon SageMaker configurations.

<img src={useBaseUrl('img/deployment/post_deployment/sc_sagemaker_00.png')} />

***Figure: Configurations for Amazon SageMaker*** 

<img src={useBaseUrl('img/deployment/post_deployment/sc_sagemaker_01.png')} />

***Figure: Configurations for Amazon SageMaker*** 

### Configuration for Amazon EMR

Amazon EMR requires a few more fields that are not available in the drop-down menu, including the following: 
- DiskSizeGB (>=10)
- CoreNodeCount (1-80)
- MasterInstanceType
- Market (ON_DEMAND / SPOT)
- WorkerBidPrice (only applicable when Market = SPOT. Specify 0 for Market = ON_DEMAND)
- WorkerInstanceType
- AmiId (Use the AMI id we copied in prerequisites - AMI)

The following figures display screenshot images that exemplify Amazon EMR configurations. 

<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_00.png')} />

***Figure: Configurations for Amazon EMR*** 

<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_01.png')} />

***Figure: Configurations for Amazon EMR***
<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_02.png')} />

***Figure: Configurations for Amazon EMR*** 

## Approving the workspace

Once the configuration completes, choose the **Approve** button. The newly created workspace type will be available for launch in the **Study and Workspace** tab.
