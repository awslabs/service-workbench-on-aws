---
id: deployment_instance
title: Deployment Instance
sidebar_label: Deployment Instance
---
## Deploying from a Local Machine

Service Workbench can be deployed from any machine, if the appropriate Named Profiles are enabled.  We have seen instances where pre-existing software, especially different versions of Node, have caused problems during the deployment.

## Deploying from an EC2 Instance

* Use a T2.medium (4 GB) EC2 instance or larger
    * Larger machines will have faster networking; larger disks will have higher performance
    * Default VPC & subnet are sufficient
* You can avoid using Profiles by attaching to your instance a IAM role with sufficient permission (such as AdministratorAccess)
