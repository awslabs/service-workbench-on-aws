---
id: summary
title: Features
sidebar_label: Features
---
Service Workbench is designed from the ground up to make it easy for you to install the application and get running quickly. 

## Serverless Framework and Projects
Service Workbench is deployed using the Serverless Framework and contains 5 serverless projects, described in **Table 1**.


| **Serverless Project**    | **Description**                                                                                                 |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------- |
| solution/backend/         | Code for the backend API and services.                                                                          |
| solution/infrastructure/  | Code for creating the required AWS infrastructure.                                                              |
| solution/machine-images/  | The machine images for Research Workspaces.                                                                     |
| solution/post-deployment/ | Code that executes upon  completion of deployment of the solution to seed data bases and configure few options. |
| solution/ui/              | Code for web-based user interface.                                                                              |
**_Table 1: Serverless Projects_**

## Continuous Integration/Continuous Delivery
The Service Workbench solution includes a Continuous Integration/Continuous Delivery feature:

- `cicd/cicd-pipeline/serverless.yml`
- `cicd/cicd-source/serverless.yml`

## Easy Installation 
You can run the Service Workbench installation from your local machine or an [Amazon Elastic Compute Cloud (Amazon EC2)](https://aws.amazon.com/ec2/?ec2-whats-new.sort-by=item.additionalFields.postDateTime&ec2-whats-new.sort-order=desc) instance. The installation involves the following:
- If you are deploying Service Workbench from Amazon EC2, create an instance with an appropriate instance profile.
- On your Amazon EC2 instance, (or local machine) install the node and node-based software.
- Download and unpack the Service Workbench code.
- Choose a **Stage Name**.
- Optionally, edit the configuration file.
- Run the main deployment script: `environment-deploy.sh`.
- Run the post-deployment script: `master-account-deploy.sh`.
- Log in and add an AWS account to your Service Workbench deployment.
- Create local user accounts.
