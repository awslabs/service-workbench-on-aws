---
id: prereq_commands
title: Prerequisite Software
sidebar_label: Prerequisite Software
---
The prerequisite software installation includes installing the required tools and creating an AWS account to deploy the solution.

## Install the Required Tools
Before building this solution, you must install the tools that are listed below:

* [Node.js](https://nodejs.org/) (10.15.x or later) 
* [AWS Command Line Interface](https://aws.amazon.com/cli/)
* [PNPM](https://pnpm.js.org/) 
* [Serverless Framework](http://www.serverless.com)


## AWS Account and Access
To deploy the solution into an account, perform the following:

1. Create a new AWS account or use an existing AWS account. 
2. Using this account, create an AWS **IAM User** and set up a named profile on your development machine with appropriate access keys and permissions to deploy resources into the account. 
3. Save the credentials in `~/.aws/credentials`, the location where the framework will look in order to deploy.
 
:::tip
For more information on configuring the AWS Command Line Interface (CLI) profiles, see [Named Profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html) in the _AWS Command Line Interface User Guide_.
:::
