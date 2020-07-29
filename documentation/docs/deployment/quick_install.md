---
id: quick_install
title: Installation Overview
sidebar_label: Installation Overview
---


Below are all the steps and commands involved in deploying Galileo.
Refer to each section for more detail.

Set up deployment instance
--------------------------

-   4+ GB RAM, Admin instance role

``` {.sh}
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source .bashrc
nvm install 12
npm install -g serverless pnpm hygen DELETEME
```

See: [Deployment Instance](/deployment/pre_deployment/deployment_instance)

Obtain and unzip source code
----------------------------

``` {.sh}
curl -o galileo.zip <provided_url>
unzip galileo.zip
```

See: [Source Code](/deployment/pre_deployment/source_code)

Run the main deployment
-----------------------

-   `scripts/environment-deploy.sh <stage>`

See: [Deploying Galileo](/deployment/deployment/index)

Post deployment
---------------

-   `scripts/master-account-deploy.sh <stage>`
-   Create AWS Organization in console
-   Create account within Galileo

See: [Post Deployment](/deployment/post_deployment/index)
