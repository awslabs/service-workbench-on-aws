---
id: prerequisites
title: Prerequisites
sidebar_label: Prerequisites
---

Main Account
------------

Galileo must be deployed from an account that is not a member of an AWS
Organization. This account must itself be capable of creating an
Organization. See: [Organizations](/deployment/reference/aws_services). If the account is not capable of creating an organization
you will not be able to create an account in Galileo in the post-installation step ['Create or add an AWS Account'](/deployment/post_deployment/link_aws_account).

Note that this account will be billed for all resources deployed by user
accounts linked to it.

Cost Explorer
-------------
In order to see any actual cost in dashboards and workspaces, the master account must have Cost Explorer set up. 

