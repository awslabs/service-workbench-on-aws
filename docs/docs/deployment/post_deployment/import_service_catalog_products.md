---
id: import_service_catalog_products
title: Import Service Catalog Products
sidebar_label: Import Service Catalog Products
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Service Workbench uses [AWS Service Catalog](https://aws.amazon.com/servicecatalog/?aws-service-catalog.sort-by=item.additionalFields.createdDate&aws-service-catalog.sort-order=desc)
to manage different types of computation resources available for researchers to use through the platform.

With AWS Service Catalog integration, Service Workbench allows Admin users to create and manage catalogs of IT services
that are approved for use on AWS. These IT services can include everything from virtual machine images,
servers, software, and databases to complete multi-tier application architectures.

With this integration, Service Workbench helps organization to centrally manage commonly deployed IT services,
and helps achieve consistent governance and meet compliance requirements,
while enabling users to quickly deploy only the approved IT services they need.


When Service Workbench is deployed, an AWS Service Catalog portfolio is created by default with four commonly used products: Amazon SageMaker, Amazon EC2 for Windows, Amazon EC2 for Linux and Amazon EMR. The **administrator** needs to import and configure these products using Service Workbench user interface before they can be deployed. If you want to include additional custom products in the AWS Service Catalog portfolio, complete these steps: 

1. Add the AWS CloudFormation template in the following directory:
* `addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/service-catalog`
2. Add the AWS CloudFormation template file name in the `productsToCreate` list in the following location: 
* `addons/addon-base-raas/packages/base-raas-post-deployment/lib/steps/create-service-catalog-portfolio.js`

## Import a Product

In this step, you import a pre-defined product, configure parameters to be used for product launch, and approve the configured product to be used. The following sections use Amazon EC2 Linux as an example, followed by setting different configuration required for Amazon EC2 Windows, Amazon SageMaker and Amazon EMR.

### Prerequisites
Ensure the following prerequisites are met in order to import a product. 

#### AMI

Make sure you completed the step, [Deploy the Machine Images SDC](/deployment/deployment/index#deploy-the-machine-images-sdc)
as part of the deployment process. 

To check if AMIs were created successfully, perform the following actions: 
  
1. Navigate to Amazon EC2. 
2. Select the '**AMI**' tab. 
3. Note down the 4 AMIs created for (1) Amazon EC2 Linux, (2) Amazon EC2 Windows, (3) Amazon EMR, and (4) Amazon EC2 Rstudio. 
4. Copy the AMI IDs and use for workspace import and configuration. Alternatively, you can also copy these AMI IDs from the terminal when the machine-images SDC is deployed.

_**Note**: If you run the machine images SDC multiple times, duplicated AMIs are created. This is okay and will not affect any Service Workbench functionalities. You can choose to remove the duplicates to avoid confusion or leave them as is._


#### Service Catalog Portfolio

1. Log in to Service Workbench UI as an **administrator**.
2. Navigate to ‘**Workspace Types**’ tab. Four AWS Service Catalog Products display as shown in **Figure 9**.

<img src={useBaseUrl('img/deployment/post_deployment/service_catalog_import_00.png')} />

***Figure 9: AWS Service Catalog Products***

These four products come from the AWS Service Catalog portfolio created by the system during deployment. And they'll be ready for use once imported and configured.

If you wish to include other AWS computation resources in future, simply add new products to the existing Service Workbench portfolio in the AWS Service Catalog.

### Import

In this section, the Amazon EC2 Linux is used as an example.

1. Click the '**Import**' button under `ec2-linux-instance`. 
2. Update **Name** and **Description** so you can easily identify the workspace.

### Configure

Once you import a workspace type, perform the following actions: 

1. Click '**Add Configuration**'
2. Add **ID**, **Name**, **Description**, and **Estimated Costs** for the configuration. A common naming convention here is to attach the instance size after the product name. For example, use `ec2-linux-instance-V1-small` for a small Linux Amazon EC2 instance. 
3. Click ‘**Next**’.
4. Add access control for the workspace configuration.
5. Click '**Next**'

The input parameters are parameters used for the product, AWS CloudFormation template. The number and type of parameters are different for different products. Most of the parameters used for the four system created products can be evaluated automatically at launch time. These parameters are available for selection in the drop-down when filling the input parameters page.

### Configuration for EC2 Linux

For Amazon EC2 Linux, the only two fields that are not available in the drop-down are ‘**InstanceType**’ and ‘**AmiId**’.

**Figure 10** and **Figure 11** display screenshot images that exemplify Amazon EC2 Linux configurations.

<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_linux_00.png')} />

***Figure 10: Configurations for Amazon EC2 Linux***

<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_linux_01.png')} />

***Figure 11: Configurations for Amazon Linux EC2***

### Configuration for Amazon EC2 Windows

For Amazon EC2 Windows, the only two fields that are not available in the drop-down are ‘**InstanceType**’ and ‘**AmiId**’. (Use the AMI ID you copied in Prerequisites - AMI)

**Figure 12** and **Figure 13** display screenshot images that exemplify Amazon EC2 Windows configurations.

<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_windows_00.png')} />

***Figure 12: Configurations for EC2 Windows*** 

<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_windows_01.png')} />

***Figure 13: Configurations for EC2 Windows*** 

### Configuration for Amazon SageMaker

For Amazon SageMaker, the only field that’s not available in the drop-down is ‘**InstanceType**’.

**Figure 14** and **Figure 15** display screenshot images that exemplify Amazon SageMaker configurations.

<img src={useBaseUrl('img/deployment/post_deployment/sc_sagemaker_00.png')} />

***Figure 14: Configurations for Amazon SageMaker*** 

<img src={useBaseUrl('img/deployment/post_deployment/sc_sagemaker_01.png')} />

***Figure 15: Configurations for Amazon SageMaker*** 

### Configuration for Amazon EMR

Amazon EMR requires a few more fields that are not available in the drop-down menu, including the following: 
- DiskSizeGB (>=10)
- CoreNodeCount (1-80)
- MasterInstanceType
- Market (ON_DEMAND / SPOT)
- WorkerBidPrice (only applicable when Market = SPOT. Specify 0 for Market = ON_DEMAND)
- WorkerInstanceType
- AmiId (Use the AMI id we copied in prerequisites - AMI)

**Figure 16**, **Figure 17**, and **Figure 18** display screenshot images that exemplify Amazon EMR configurations. 

<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_00.png')} />

***Figure 16: Configurations for Amazon EMR*** 

<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_01.png')} />

***Figure 17: Configurations for Amazon EMR***
<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_02.png')} />

***Figure 18: Configurations for Amazon EMR*** 

## Approve

Once the configuration completes, click the ‘**Approve**’ button; the newly created workspace type will be available for launch in the ‘**Study and Workspace**’ tab.
