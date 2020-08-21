---
id: summary
title: Summary
sidebar_label: Summary
---

Galileo has been designed from the ground up to be easy to install and get running quickly. To deploy this solution the Serverless Framework is used.

The solution contains 5 serverless projects:

| Serverless Project | Description |
| :-- | :-- |
| solution/backend/ | Code for the Backend API and Services. |
| solution/infrastructure/ | Code for the creation of the AWS Infrastructure required. |
| solution/machine-images/ | The machine images for the Research Workspaces. |
| solution/post-deployment/| Code that executes upon the completion of the deployment of the solution to seed data bases and configure some options.|
| solution/ui/ | Code the the web-based user interface. |


The solution also includes a Continuous Integration/Continuous Delivery feature:

- cicd/cicd-pipeline/serverless.yml
- cicd/cicd-source/serverless.yml


A Galileo installation can be run from your laptop or an EC2 instance
and involves the following stages that will be described in detail in this section of the documentation and its sub-sections:

-   If deploying from EC2, create an instance with an appropriate
    instance profile
-   Installing Node and some Node-based software on your local machine
    or EC2 instance
-   Downloading and unpacking the Galileo code
-   Choosing a stage name
-   Optionally editing a configuration file
-   Running the main installation script `environment-deploy.sh`
-   Running the post-deployment script `master-account-deploy.sh`
-   Log in and add an AWS account to your Galileo deployment
-   Create local user accounts


