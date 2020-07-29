---
id: deployment_instance
title: Deployment Instance
sidebar_label: Deployment Instance
---

-   

    Use a T2.medium (4 GB) EC2 instance or larger

    :   -   Larger machines will have faster networking; larger disks
            will have higher performance
        -   Default VPC & subnet are sufficient

-   

    Attach to your instance a IAM role with sufficient permission (such as AdministratorAccess)

    :   -   See: [Add an IAM role to an instance](/deployment/reference/iam_role)

Prerequisite Software
---------------------

-   

    Install **node**, **serverless**, **pnpm**, and **hygen** by submitting the commands below

    :   -   If running Amazon Linux, **node** is not available through
            **yum**, so it is installed using **nvm**
            (<https://github.com/nvm-sh/nvm>)

```{=html}
<!-- -->
```
-   **node** and all packages are installed in eg:
    `~/.nvm/versions/node/v12.18.1/bin/node`
-   Verify with eg: `hygen --version`
