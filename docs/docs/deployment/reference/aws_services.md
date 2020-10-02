---
id: aws_services
title: AWS Services
sidebar_label: AWS Services
---
import useBaseUrl from '@docusaurus/useBaseUrl';

## AWS Services

This section describes some of the AWS services used by Service Workbench.  The resource names usually include the [namespace](/deployment/pre_deployment/configuration#Namespace) including the stage name used at deployment, so you can deploy multiple instances of Service Workbench from the same account if you use a different stage name for each deployment.

### EC2

EC2 is used only as a platform from which to deploy Service Workbench.  For more details see [Deployment Instance](/deployment/pre_deployment/deployment_instance)

### IAM

Service Workbench creates several roles in your account. The role ``<namespace>-prep-raas-master-MasterRole-XXX`` is created when you run the [Post Deployment](/deployment/post_deployment/index) SDC.  This role has as Trust Relationship to trust the Main account from which you deploy Service Workbench, and two Policies allowing that account to assume a role in this Master account (see [Account Structure](/user_guide/account_structure)).

<img src={useBaseUrl('img/deployment/reference/iam_role_00.jpg')} width='350' /><img src={useBaseUrl('img/deployment/reference/iam_role_01.jpg')} width='350' />

Associated with the role is an [External ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).  This is an identifying string provided when the role is created.  In order for the Trusted Entity (your Main account) to assume role into the Master Account, it must supply this External ID.  This provides a lightweight means of establishing a revokable relationship.  

In the current Service Workbench deployment, the External ID is configured as a default value in ``main/solution/prepare-master-acc/config/settings/.defaults.yml`` and it is the string **workbench**.  To change this value, create a stage-named configuration file (`mystagename.yml`) in the same directory (see [Configuration](/deployment/pre_deployment/configuration))

<img src={useBaseUrl('img/deployment/reference/iam_role_02.jpg')} width='400' />

### Organizations

An AWS Organization is created in the [Master Account](/user_guide/account_structure).  This Organization will have an account created for each deployment from this account; the name of the account is the stage name used.

<img src={useBaseUrl('img/deployment/reference/organizations_01.jpg')} width='500' />

### S3

Multiple S3 buckets are created by Service Workbench.  Filtering by stage name shows the buckets for a deployment.

<img src={useBaseUrl('img/deployment/reference/s3_00.jpg')} width='400'/>

The 'studydata' bucket contains all the data for the various [Studies](/user_guide/sidebar/common/studies/introduction) in this deployment at the individual and organization level.

<img src={useBaseUrl('img/deployment/reference/s3_01.jpg')} width='400' />

### Cost Explorer

Service Workbench has the ability to show actual cost incurred by workspaces running under the master account. This is using the Cost Explorer service in the AWS Console.
Cost Explorer must be manualy set up for each master account once in order to allow requests for cost data to process. Setting this up requires background processes to complete in the master account, which can take up to 24 hours.
