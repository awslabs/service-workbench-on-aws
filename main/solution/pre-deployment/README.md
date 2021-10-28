# Pre-Deployment

## To invoke pre deployment locally

After you run:

```bash
$ pnpx sls deploy -s <stage>
```

You can invoke lambda locally:

```bash
$ pnpx sls invoke local -f preDeployment -s <stage>
```

## Overview of Lambda Functions

We customize each deployment using a Lambda function. This function runs a list of deployment steps.

- Pre-deployment Lambda

  There are certain actions that need to take place before the solution is deployed:

  - If egress feature is enabled, validate existing BYOB bucket. There should be no existing BYOB with Read and Write access
