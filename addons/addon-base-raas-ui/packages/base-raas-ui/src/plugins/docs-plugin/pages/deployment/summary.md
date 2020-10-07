---
id: summary
title: Summary
sidebar_label: Summary
---

## Structure
Service Workbench has been designed from the ground up to be easy to install and get running quickly. To deploy this solution the Serverless Framework is used.

The solution contains 5 serverless projects:

| Serverless Project        | Description                                                                                                             |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| solution/backend/         | Code for the Backend API and Services.                                                                                  |
| solution/infrastructure/  | Code for the creation of the AWS Infrastructure required.                                                               |
| solution/machine-images/  | The machine images for the Research Workspaces.                                                                         |
| solution/post-deployment/ | Code that executes upon the completion of the deployment of the solution to seed data bases and configure some options. |
| solution/ui/              | Code the the web-based user interface.                                                                                  |

The solution also includes a Continuous Integration/Continuous Delivery feature:

- cicd/cicd-pipeline/serverless.yml
- cicd/cicd-source/serverless.yml

## Installation
A Service Workbench installation can be run from any machine (local or EC2 instance) in which you can install the AWS CLI and some Node-based software.
It involves the following stages that will be described in detail in this documentation:

* Choose an account in which to deploy Service Workbench (master or member account of an Organization)
* Configure and test an AWS CLI profile for this account
* Install AWS CLI, Node, and some Node-based software on the local machine or EC2 instance
* Download and unpack the Service Workbench code
* Choose a stage name
* Edit the main configuration file
* Run the main installation script `environment-deploy.sh` (20 minutes)
* Deploy the **machine-images** stage (20 minutes)
* If vending accounts from Service Workbench, deploy the **prepare-master-acc** stage
* Log in to the Service Workbench deployment with the root account
* Add (import) or create an AWS account for billing
* Create Service Workbench user accounts
* Provision workspace types in Service Catalog (4 example products already supplied)
