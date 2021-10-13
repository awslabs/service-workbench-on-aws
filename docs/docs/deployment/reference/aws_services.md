---
id: aws_services
title: Usage of AWS Cloud Services
sidebar_label: AWS Cloud Services
---
import useBaseUrl from '@docusaurus/useBaseUrl';

This section describes some of the AWS Cloud services used by Service Workbench. The resource names usually include the **Namespace**, including the  [**stage name**](/deployment/pre_deployment/configuration#Namespace) used at deployment. You can deploy multiple instances of Service Workbench from the same account if you use a different stage name for each deployment.

### Amazon EC2

Amazon EC2 is used only as a platform from which to deploy Service Workbench. For more details see the [Deployment Instance](/deployment/pre_deployment/deployment_instance) section. 

### AWS IAM role

Service Workbench creates several roles in your account. The role `<namespace>-prep-raas-master-MasterRole-XXX` is created when you run the  [post deployment](/deployment/post_deployment/index) SDC.  This role possesses a trust relationship with the Main account from which you deployed Service Workbench. There are two polices that allow the main account to assume a role in this management account. The [account structure](/user_guide/account_structure) defines each type of account. **Figure 32** shows the AWS IAM ‘**Trust Relationships**’ tab. 

<img src={useBaseUrl('img/deployment/reference/iam_role_00.jpg')} width='350' /><img src={useBaseUrl('img/deployment/reference/iam_role_01.jpg')} width='350' />

***Figure 32: AWS IAM Trust Relationships Tab***

An [external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html)is associated with the role. The External ID is an identifying string that is provided once a role is created. In order for the trusted entity (your Main account) to assume its role in the management account, it must supply this external ID. Providing the external ID of establishes a revocable relationship between the trusted entity and the management account.

In the current Service Workbench deployment, the External ID is configured as a default value in the following string workbench: 

```
main/solution/prepare-master-acc/config/settings/.defaults.yml
```
To change this value, create a stage-named configuration file (`mystagename.yml`) in the same directory. For more information, see the [Configuration](/deployment/pre_deployment/configuration) section. The following figure displays a screenshot image of the conditions that define how **Trusted Entities** assume a role.

<img src={useBaseUrl('img/deployment/reference/iam_role_02.jpg')} width='400' />

***Figure: Defining Conditions for Trusted Entities***

### AWS Organizations

An AWS Organization is created in the **Master** account. The management account is discussed in the [Account Structure](/user_guide/account_structure) section in more detail. The AWS Organization use the management account to create a separate account for each deployment. The account’s name is the stage name used. The following figure shows a screenshot image of the AWS Organizations ‘**Accounts**’ tab. 

<img src={useBaseUrl('img/deployment/reference/organizations_01.jpg')} width='500' />

***Figure: AWS Organizations account page*** 

### Amazon S3

Multiple Amazon S3 buckets are created by Service Workbench. Filtering by **Stage Name** shows the Amazon S3 buckets for a deployment. The following figure shows the Amazon S3 buckets for the Service Workbench deployment. 

<img src={useBaseUrl('img/deployment/reference/s3_00.jpg')} width='400'/>

***Figure: Amazon S3 Buckets for a Service Workbench Deployment***

The '**studydata**' bucket contains all the data for the various [Studies](/user_guide/sidebar/common/studies/introduction) in this deployment at the individual and organization level. The following displays an image of the contents within the studydata bucket.  

<img src={useBaseUrl('img/deployment/reference/s3_01.jpg')} width='400' />

***Figure: Amazon S3 StudyData Bucket***

### AWS Cost Explorer

Service Workbench has the ability to show actual cost incurred by workspaces running under the management account. This is using the AWS Cost Explorer service in the AWS Management Console. AWS Cost Explorer must be manually set up for each management account once in order to allow requests for cost data to process. Setting this up requires background processes to complete in the management account, which can take up to 24 hours.