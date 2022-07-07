---
id: account_structure
title: Account Structure
sidebar_label: Account Structure
---

## Account Structure

Service Catalog uses three kinds of accounts, whose names are used in this guide. _Master_ and _Member_ accounts are terms referring to [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html), while _Main_ account is a Service Catalog term.

- **Main**: The account within which Service Catalog is deployed. The main account will be billed for all AWS usage charges for the Service Catalog deployment itself: the S3 bucket holding the website, and other resources not created by a user. Service Catalog may be deployed in a master account (the account holding the Organization), or a member account (within the Organization). In either case, this account is called the Service Catalog _Main_ account.
- **Master**: The account hosting the AWS Organization. The master account is responsible for the billing of the member accounts within the Organization.
- **Member**: An account within an AWS Organization. When you create an account using [Create AWS Account](/deployment/post_deployment/aws_accounts#Create_AWS_Account), that account is created as a member of the Organization.

See also in the source code:

- `README.md`
- `main/solution/prepare-master-acc/README.md`

### Local Users

Local users are created only within the solution and their credentials stored in DynamoDB. This is a fast way to get an installation working since the alternative is to integrate with an AD.
