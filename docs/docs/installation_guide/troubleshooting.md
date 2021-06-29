---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
---


**Problem**: Running `scripts/environment-deploy.sh $STAGE` fails with the message `Uploaded file must be a non-empty zip`.

**Workaround**: This problem occurs because of a known issue with AWS CDK described in [https://github.com/aws/aws-cdk/issues/12536](https://github.com/aws/aws-cdk/issues/12536). Update/downpatch `Node.js` to version 12.x.