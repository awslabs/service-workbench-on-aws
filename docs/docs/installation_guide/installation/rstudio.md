---
id: rstudio
title: Setting up RStudio ALB workspace
sidebar_label: Setting up RStudio ALB workspace
---

### Overview

You can access the RStudio workspace type by using the template and AMI provided in AWS partner’s repository. The following table summarizes the sequence of steps that you need to follow to complete the installation for RStudio ALB workspace in the Service Workbench environment.

| Task      | Description |
| ----------- | ----------- |
| [Creating main account and hosting account](#createacct)      | Provides information on how to set up the environment used for RStudio workspace types. In these accounts, you will set up hosted zones, configure the certificates required for deploying RStudio ALB workspace.      |
| [Creating a public hosted zone in the main account](#hostedzone)  | Provides routing information about how you want to route traffic for a domain/subdomain.        |
| [Creating a new name server record in the shared domain](#nserver)      | Provides a name to the hosted zone. Here, you will copy the values (containing routing information) that you created in the main account.       |
| [Requesting a public certificate in main account for the hosted zone](#pubcert)   | Request a public certificate in the main account for the hosted zone. The region is chosen as `us-east-1`. Using this option, you request a public certificate from Amazon. By default, these public certificates are trusted by browsers and operating systems.        |
| [Creating a staging file using the latest Service Workbench code](#staging)   |Download the latest Service Workbench code and set up the staging file for deploying RStudio ALB workspace. For more information about staging file, see [Configuration settings](/installation_guide/installation/pre-installation/conf-settings).       |
| [Creating AMIs](#ami)      | Provides the basis of RStudio environment that researchers use for research. Refer to the AWS partner’s [README](https://github.com/RLOpenCatalyst/Service_Workbench_Templates/blob/main/RStudio/machine-images/config/infra/README.md) for more information.       |
| [Installing EC2 RStudio Server](#rstudio)   | Deploys RStudio into Service Workbench’s portfolio. Refer to the AWS partner’s [README](https://github.com/RLOpenCatalyst/Service_Workbench_Templates/blob/main/RStudio/machine-images/config/infra/README.md) for more information.        |
| [Requesting a new public certificate within member account for hosted zone domain](#newpubcert)   | Provides steps on how to request a public certificate for member (hosting) account using ACM. The certificate contains the ARN value that is used to import the products.        |
| [Creating a new record in the main account hosted zone](#newrec)   | Validates the member account public certificate. Without the validation, no workspaces can be created.        |
| [Accessing RStudio Workspace in Service Workbench](#swb)   | Configure RStudio ALB using Service Workbench.       |


### Creating main account and hosting account

<a name="createacct"></a>

**Task**: You will learn to create a main account and a hosting account and assign Admin role to these accounts.

1. Choose **Create/Register Account**.
2. On the **Account Creation** page, choose **Create**.
3. On the **Create AWS Accounts** page, specify the account email address, account name, secondary owner, financial owner, ownership group, description, and account type.
4. Choose **Submit**.
5. Choose **Manage Account**.
6. Create a console role:    
       a. Choose **Add**.    
       b. For **One Click Roles**, choose **Admin**.

**Note**: Follow the same steps above to create a hosting account and choose the admin role. In the description, specify that it is a hosting account.


### Creating a public hosted zone in the main account

<a name="hostedzone"></a>

**Task**: You will learn to create a public hosted zone for the main account and add routing information to it. 

1. Sign in to the AWS Management Console.   
2. Under AWS Services, choose **Route 53**.     
3. On the Route 53 dashboard, choose **Hosted zones**.      
4. Choose **Create hosted zone**.
5. On the **Create hosted zone** page:         
     a.	For **Domain name**, enter the domain name.            
     b.	For **Description – optional**, enter the description.       
     c.	For **Type**, choose **Public hosted zone**.       
6. Choose **Create hosted zone**.     
7. Copy the values from the **Value/Route traffic to** field for later use.   

### Creating a new name server record in the shared domain

<a name="nserver"></a>

**Task**: You will learn to create a new record name for the public hosted zone.

1.	Sign in to the AWS Management Console.
2.	Under AWS Services, choose **Route 53**.
3.	On the Route 53 dashboard, choose **Hosted zones**.
4.	Choose the hosted zone that you just created.
5.	Choose **Create record**.
6.	On the **Quick create record** page, choose **Add another record**.
7.	For **Record name**, enter the name.
8.	For **Record type**, choose **NS – Name servers for a hosted zone**.
9.	For **Value**, enter the values that you copied from the Value/Route traffic to field earlier.
10.	For **TTL (seconds)**, enter the value.
11.	For **Routing policy**, choose **Simple routing**.
12.	Choose **Create records**.

### Requesting a public certificate in main account for the hosted zone

<a name="pubcert"></a>

**Task**: You will learn how to request a certificate for the main account in AWS Certificate Manager (ACM) and access the CNAME record details from that certificate.

#### Requesting a certificate in AWS Certificate Manager 

1.	Sign in to the AWS Management Console.    
2.	Go to AWS Certificate Manager.     
     **Note**: To use an ACM certificate with Amazon CloudFront, you must request or import the certificate in the US East (N. Virginia) region.      
3.	Choose **Request a certificate**.     
4.	On the **Request certificate** page, choose **Request a public certificate**.     
5.	Choose **Next**.      
6.	On the **Request a public certificate** page:      
     a.	For **Domain names**, enter the domain name.    
     b.	For **Select validation method**, choose **DNS validation – recommended**.     
7.	Choose **Request**.    
8.	Refresh your screen to view the newly created certificate.     
9.	Choose the certificate to view the details.       
10.	Under **Domains**, copy the values for **CNAME name** and **CNAME value**.       

#### Creating a new record in the main account

1.	Go the main account. 
2.	Choose the hosted zone created earlier. See [Creating a public hosted zone in the main account](#hostedzone).
3.	Create a new record.
4.	For **Record name**, paste the first part of the **CNAME** record created in the previous section. 
5.	For **Value**, paste the **CNAME value** copied in the previous section.
6.	Choose **Create records**.

### Creating a staging file using the latest Service Workbench code

<a name="staging"></a>

**Task**: You will learn how to create and configure the staging file for setting up the RStudio ALB workspace.

1.	Go to the `/main/config/settings` directory.    
2.	Create a new staging file. Example:      
      `cp example.yml albr.yml`
3.	In the newly created stage file, remove comments and keep awsRegion as us-east-1. You can change the value of awsProfile , for example, rstudio. Update the configuration (config file) and credentials (credentials file) within the `.aws` folder so that the new account details are included. The updated config file should have the following values: `region` (default is `us-east-1`), output (`yaml`), `account_id`, and `role_name`. To update credentials, you need to create a CLI user. For more information on creating a user, see [IAM users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).     
4. For `solutionName`, enter `sw`.     
5. For `envName`, enter the stage name, for example, `albr`.      
6. For `envType`, enter a name, for example, `dev`.     
7. For `createServiceCatalogPortfolio`, enter the value as `true`.      
8. For `rootUserEmail`, enter the email address.      
9. For `domainName`, enter the domain name of the main account hosted zone.       
10. For `certificateArn`, copy the certificate ARN of the main account and paste it.       
11. From `defaults.yml` file, copy the hostedZoneId into the newly created staging file (for example, `albr.yml`). 
12. Copy the Hosted zone ID details Hosted zone page in Route 53 and paste it in `hostedZoneId` in your staging file.     

Your new stage file is now ready for deployment.

### Creating AMIs 

<a name="ami"></a>

Follow the instructions in the README to install EC2 RStudio server AMIs. You can go to your main account and access these AMIs under Images.

Note: Edit the configuration file (`RStudio/machine-images/config/infra/configuration.json`). You need to update the region (to match your deployment config file), `amiName` (suggested: `rstudio-alb`), and `awsProfile` (to match your deployment config file). Update `stageName` to match your deployment configuration file.

### Installing EC2 RStudio Server

<a name="rstudio"></a>

Follow the instructions in the README to install EC2 RStudio server.

### Requesting a new public certificate within member account for hosted zone domain

<a name="newpubcert"></a>

**Task**: You will learn to request a public certificate for member (hosting) account using ACM and copy the ARN value.

1.	Sign in to the AWS Management Console.
2.	Choose Certificate Manager. 
3.	On the **AWS Certificate Manager** page, choose `Request a certificate`.
4.	Choose `Next`.
5.	For `Certificate type`, choose `Request a public certificate`.
6.	Choose `Next`.
7.	On the `Request a public certificate` page:     
     a.	For `Domain names`, enter the domain name in the following two ways: `example.corp.com` and `*.example.corp.com`. Here, `example.corp.com` is the full domain name.       
     b.	For **Select validation method**, choose **DNS validation – recommended**.       
8.	Choose **Request**.
9.	On the **Certificate** page, within Certificate status, copy the ARN. The ARN will be used to import the products.

### Creating a new record in the main account hosted zone

<a name="newrec"></a>

**Task**: This task validates the member account public certificate. 

1.	Go to the hosting account certificate manager.
2.	On the certificate page, copy values for `CNAME name` and `CNAME value`.
3.	Switch over to the main account.
4.	On the AWS Management Console, choose **Route 53**.
5.	Choose **Hosted zones**.
6.	Choose the domain name.
7.	Choose **Create new record**.
8.	For **Record name**, paste the first part of the CNAME record created in the previous section. 
9.	For **Record type**, choose **CNAME – Routes traffic to another domain**.
10.	For **Value**, paste the **CNAME value** copied in the previous section.
11.	Choose **Create records**.

### Accessing RStudio Workspace in Service Workbench

<a name="swb"></a>

**Task**: You will log in to Service Workbench, create a user and configure the account for using RStudio ALN workspace.

1.	Sign in to Service Workbench first time as the root user.
2.	Add a local user.
3.	For **Accounts**, **AWS Accounts**, **Add AWS Account**, add the member account.
4.	For **Accounts**, **Indexes**, **Add Index** associated with member account, create an index.
5.	For **Accounts**, **Projects**, **Add Project** associated with that index, create a new project.
6.	For **Users**, **Users**, **Detail**, **Edit**, associate the user with the new project.
7.	Import EC2 RStudio Server and add new configuration for the workspace type. `ACMSSLCertArn` is asking for the member account certificate ARN. 
8.	Enter the instance type for the EC2 instance. `AmiId` is the AMI ID of the newly created AMI in the main account. 
9.	Approve the configuration.
10.	Create a new workspace in by selecting the RStudio Server workspace type and configuration.
11.	Connect to the RStudio Workspace. Make sure popups are enabled. 

