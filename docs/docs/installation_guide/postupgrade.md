---
id: postupgrade
title: Post upgrade
sidebar_label: Post upgrade
---
### Updating accounts

Any new hosting accounts added to Service Workbench must be updated with new permissions.  For this process, you need onboard-account.cfn.yml, which is part of the source-code distribution.
For each hosting account:

1. Log in to the AWS Management Console of the hosting account.
2. In the CloudFormation console of that account, select the stack used for onboarding the member account (usually the stack name starts with `initial-stack-`)
3. Choose Update stack and select the `addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/onboard-account.cfn.yml` file, which may also be downloaded here:  [onboard-account.cfn.yml](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/onboard-account.cfn.yml). All existing parameters on that stack should still work.

### Testing the operation

After the deployment script has completed without errors, log in to the Service Workbench UI and test its functionality.  To display the URL and root password, run `scripts/get-info.sh ${STAGE_NAME}`.