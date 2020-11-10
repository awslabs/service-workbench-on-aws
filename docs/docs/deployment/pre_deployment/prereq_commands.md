---
id: prereq_commands
title: Prerequisite Software
sidebar_label: Prerequisite Software
---
## Required Tools
Before you can build this solution, you need the following tools installed on the machine from which you will be deploying:

* AWS Command Line Interface (<https://aws.amazon.com/cli/>)
* Node.js (10.15.x or later) (<https://nodejs.org/>)
* PNPM (<https://pnpm.js.org/>)
* Serverless Framework (<http://www.serverless.com>)
* Hygen CLI (<http://www.hygen.io>)
* Go (<https://golang.org/doc/install>)

You can install NodeJS, and other prerequisites the following way:

``` {.sh}
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.bashrc
nvm install 12
npm install -g serverless pnpm hygen

wget https://golang.org/dl/go1.15.3.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.15.3.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin 
```

## AWS Account & Access
You will need to create a new AWS account or have an existing AWS account to deploy this solution into.

With that account you will also need to create an IAM user and set up a named profile on your development machine with the appropriate access keys and permissions to deploy resources in to the account. The credentials should be saved in ‘~/.aws/credentials’, as this is where the framework will look in order to deploy. 

:::tip
For more information on how to configure AWS CLI profiles see [https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
:::
