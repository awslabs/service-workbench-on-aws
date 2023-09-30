# start-image-builder

## Overview

This script allows you to initialize an AppStream Image Builder

## Pre-requisite

If you haven't navigated to AWS AppStream in your main account via the AWS Management Console, please do so first. Click "Get Started" on the screen and then click "Next". This activates AppStream in your main account, following which you could proceed with the commands in `SETUP.md` file.

## Development

Please refer [here](./SETUP.md##launching-an-appstream-image-builder-instance)

# update-vpce-with-existing-byob

## Overview

This script allows you to backfill AppStream Hosting Account VPCs with the necessary VPC endpoints starting from SWB v6.1.0. The script updates all hosting account VPC Endpoints for KMS and STS access so that keys and assumed roles used by BYOB buckets that had been imported prior to SWB v6.1.0 have the proper VPC Endpoint policies.

## Pre-requisite

Update all Hosting Account CloudFormation stacks with the onboard-account.cfn.yml from at least SWB v6.1.0 so that all accounts show status Up-To-Date.

## Development

This script requires the caller to have setup their IAM credentials (either as a role or user) locally so that they are able to perform the following AWS Service calls using their credentials:

1. DynamoDB Scan permission on the SWB Studies tables
2. DynamoDB GetItem permission on the SWB AwsAccounts, Indexes, and Projects tables
3. STS AssumeRole permission on each Hosting Account's Cross Account Role

The script can be invoked by running the following:

```
1. npm install
2. npm run update-vpce-with-existing-byob -- <stage-regionAbbreviation-solutionName> <region>
# Example: npm run update-vpce-with-existing-byob -- dev-va-sw us-east-1
```
