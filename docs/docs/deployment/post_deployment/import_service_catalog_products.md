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

When Service Workbench is deployed, a Service Catalog portfolio is created by default with four
commonly used products: SageMaker, EC2 Windows, EC2 Linux and EMR. Admin user needs to import and configure these products
using Service Workbench UI before they can be deployed.

> If you would like additional custom products included in the Service Catalog portfolio, add the CloudFormation template
> in diirectory `addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/service-catalog`, and add the
> CloudFormation template file name in the `productsToCreate` list in
> `addons/addon-base-raas/packages/base-raas-post-deployment/lib/steps/create-service-catalog-portfolio.js`

<!---
( If you installed Service Workbench after 2020/07/30, ignore the following content )

Note: If you installed Service Workbench before 2020/07/30, Service Catalog is disabeld by default

To enable Service Catalog integration, pull the latest code and redeploy.

If you wish to opt out on Service Catalog and continue using the built-in workspace, override parameter
enableBuiltInWorkspaces to be true in settings file ``main/config/settings/.defaults.yml``

When Service Catalog mode is enabeld, workspaces created using built-in mode are not visible. Vise versa, when built-in mode
is enabled, workspaces created using Service Catalog are not visible either. Use the parameter enableBuiltInWorkspaces
to toggle between these two modes if needed.
--->

## Import a Product

In this step you will import a pre-defined product, configure parameters to be used for product launch, and approve
the configured product to be used. We will use EC2 Linux as an example first, and then dive into the different
configuration needed for EC2 Windows, SageMaker and EMR.

### Prerequisites

#### AMI

Make sure you finished [Deploy the machine-images SDC](/deployment/deployment/index#deploy-the-machine-images-sdc)
as part of the deployment process.
To check if AMIs were created successfully, navigate to EC2, AMI tab, note the 4 AMIs created for
EC2 Linux, EC2 Windows, EMR, and EC2 Rstudio. Copy the AMI ids from there to be used for
workspace import and configuration. Alternatively, you can also copy these AMI ids from the terminal when the
machine-images SDC is deployed.

> Note: If you run the machine images SDC multiple times, duplicated AMIs will be created. This is okay and will not affect
> any Service Workbench functionalities. You can choose to remove the duplicates to avoid confusion or leave it as is.

<!--- Note: If you installed Service Workbench before 2020/07/30, redeploy the machine-images SDC to create AMIs for Service Catalog products
 --->

#### Service Catalog Portfolio

Log in to Service Workbench UI as an Admin user, navigate to workspace types tab. You would see four AWS Service Catalog Products
listed as below:

<img src={useBaseUrl('img/deployment/post_deployment/service_catalog_import_00.png')} />

These four products come from the Service Catalog portfolio created by the system during deployment. And they'll be ready
for use once imported and configured.

If you wish to make other AWS computation resources available in the future, simply add new products to the existing portfolio
in Service Catalog.

### Import

Let's use EC2 Linux as an example.

Click the 'import' button under ec2-linux-instance, update name and description so they can be easily identified.

### Configure

Once a workspace type is imported, click add configuration. Add Id, Name, Description and Estimated Costs for the configuration.
A common naming convention here is to attach the instance size after the product name. For example, use 'ec2-linux-instance-V1-small'
for a small linux EC2 instance. Click next.

Add access control for the workspace configuration, click next.

The input parameters are parameters needed by the product CloudFormation template. The number and type of parameters are different
for different products. Most of the parameters needed for the four system created products can be evaluated automatically at launch time.
These parameters will be available for selection in the dropdown when filling the input
parameters page.

Here are examples for configuring the four system created products:

### Configuration for EC2 Linux

For EC2 Linux, the only two fields not available in drop down are instance type and AMI id.
<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_linux_00.png')} />
<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_linux_01.png')} />

### Configuration for EC2 Windows

For EC2 Windows, the only two fields not available in drop down are instance type and AMI id. (Use the AMI id we copied in prerequisites - AMI)
<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_windows_00.png')} />
<img src={useBaseUrl('img/deployment/post_deployment/sc_ec2_windows_01.png')} />

### Configuration for SageMaker

For SageMaker, the only field not available in drop down is Instance Type. To make sure you're using the right SageMaker type be sure that the configuration options includes "AccessFromCIDRBlock"
<img src={useBaseUrl('img/deployment/post_deployment/sc_sagemaker_00.png')} />
<img src={useBaseUrl('img/deployment/post_deployment/sc_sagemaker_01.png')} />

### Configuration for EMR

EMR requires a few more fields not available in drop down

- DiskSizeGB (>=10)
- CoreNodeCount (1-80)
- MasterInstanceType
- Market (ON_DEMAND / SPOT)
- WorkerBidPrice (only applicable when Market = SPOT. Specify 0 for Market = ON_DEMAND)
- WorkerInstanceType
- AmiId (Use the AMI id we copied in prerequisites - AMI)

<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_00.png')} />
<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_01.png')} />
<img src={useBaseUrl('img/deployment/post_deployment/sc_emr_02.png')} />

### Configuration for RStudio

For RStudio, the only two fields not available in drop down are instance type and AMI id (same as EC2 Linux).

<img src={useBaseUrl('img/deployment/post_deployment/sc_rstudio_00.png')} />
<img src={useBaseUrl('img/deployment/post_deployment/sc_rstudio_01.png')} />

### Approve

Once configuration completes, click the approve button, the newly created workspace type would be available for launch in
the study and workspace tab.
