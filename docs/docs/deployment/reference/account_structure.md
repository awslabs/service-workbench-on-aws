---
id: account_structure
title: Account Structure 
sidebar_label: Account Structure 
---

Read in the source code documentation:

-   `README.md`
-   `main/documentation/aws-accounts-readme.md`
-   `main/solution/prepare-master-acc/README.md`

Galileo uses 3 types of accounts, whose names are used in this guide

-   *Main*: The account from which Galileo is deployed. Will be billed
    for all AWS usage charges in this deployment
-   *Master*: Holds the AWS Organization which creates Member accounts
-   *Member*: User accounts created within Galileo for individuals.

*NOTE*: Ensure that the account from which you are deploying Galileo is
not a member of an AWS Organization. You must be able to create an AWS
Organization from this account, which you cannot do if the account is
itself a member of an Organization.

Enable Local Users {#local_users}
------------------

Local users are created only within the solution and their credentials
stored in DynamoDB. This is a fast way to get an installation working
since the alternative is to integrate with an AD.
