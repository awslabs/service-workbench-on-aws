---
id: prerequisites
title: Prerequisites
sidebar_label: Prerequisites
---

Deployment Account
------------
This solution can be deployed to an existing AWS Organization master account, or a member account, or some other account not part of the AWS Organization. 

The solution must be deployed from an account that is not a member of an AWS
Organization. This account must itself be capable of creating an
Organization. See: [Organizations](/deployment/reference/aws_services). If the account is not capable of creating an organization
you will not be able to create an account within the solution as part of the post-installation step ['Create or add an AWS Account'](/deployment/post_deployment/link_aws_account).

Cost Explorer
-------------
In order to see any actual cost in dashboards and workspaces, the master account must have Cost Explorer set up. 
