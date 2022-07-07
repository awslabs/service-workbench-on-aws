---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
---


**Problem**: Running `scripts/environment-deploy.sh $STAGE` fails with the message `Uploaded file must be a non-empty zip`.

**Solution**: This problem occurs because of a known issue with AWS CDK described in [https://github.com/aws/aws-cdk/issues/12536](https://github.com/aws/aws-cdk/issues/12536). Update/downpatch `Node.js` to version 12.x.

**Problem**: Dependency issues when installing Service Workbench as a root user.

**Solution**: Use `ec2-user` when installing Service Workbench. If you install as a root user, you might get dependency issues.

**Problem**: Building machine images hangs and fails to generate any output in the terminal.

**Workaround**: Check that you have a default VPC and this has an internet gateway attached. If a default VPC is not available or cannot be created, then you can manually create an internet connected VPC. Make a copy of `/main/solution/machine-images/config/settings/example.yml` to create a similar config file for your stage. In this file, specify the `VPCId` and a `subnetId` for your custom VPC.
