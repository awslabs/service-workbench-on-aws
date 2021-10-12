---
id: tool-req
title: Tool requirements
sidebar_label: Tool requirements
---

import useBaseUrl from '@docusaurus/useBaseUrl';

The initial prerequisites include creating a main account in AWS, enabling the AWS Cost Explorer and activating the cost allocation tags.

**Important**: Before installing Service Workbench, ensure that you have practical knowledge of core AWS services. 

### Setting up the main account

Main account is the AWS account where Service Workbench is deployed.
 
### Enabling AWS Cost Explorer

In order to see the actual cost in dashboards and Workspaces, you must set up a master account in AWS Cost Explorer. The master account holds the AWS Organization that creates member accounts. 

**Note**: You can enable AWS Cost Explorer even after installing Service Workbench. 

To enable AWS Cost Explorer in the account into which you will be deploying Service Workbench on AWS, follow these steps:

1. From the account drop-down, choose **My Billing Dashboard**.

<img src={useBaseUrl('img/deployment/installation/billing_dashboard.png')} />

2. Choose **Cost Explorer** from the sidebar.

<img src={useBaseUrl('img/deployment/installation/cost_explorer1.png')} />

3. Select **Launch Cost Explorer**.

<img src={useBaseUrl('img/deployment/installation/cost_explorer2.png')} />

**Note**: The initialization can take up 24 hours; however, it does not have to be completed before starting the installation process.

### Activating the cost allocation tags

Activate the necessary cost allocation tags in the **AWS Billing & Cost Management Dashboard**:

1. Sign in to the AWS Management Console and open the **Billing & Cost Management Dashboard** [here](https://console.aws.amazon.com/billing/).

2. In the navigation pane, choose **Cost allocation tags**.

<img src={useBaseUrl('img/deployment/installation/cost_atags1.png')} /> 

3. Under User-defined cost allocation tags, choose **createdBy**, **Env**, and **Proj** tags.
 
<img src={useBaseUrl('img/deployment/installation/cost_atags2.png')} />

**Note**: There might be a delay after enabling the AWS Cost Explorer before these tags are visible. 

If you have enabled Cost Explorer, but you do not see these tags through the AWS Console, you can still proceed with the installation.  Check later (it could be up to 24 hours after enabling Cost Explorer) and enable the tags for cost reporting to function correctly in Service Workbench.

For more information, see [Billing and Cost Management](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-what-is.html).
