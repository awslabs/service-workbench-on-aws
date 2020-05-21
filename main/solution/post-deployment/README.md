# Post-Deployment

## To invoke post deployment locally

After you run:

```bash
$ pnpx sls deploy -s <stage>
```

You can invoke lambda locally:

```bash
$ pnpx sls invoke local -f postDeployment -s <stage>
```

## Overview of Lambda Functions

We customize each deployment using a Lambda function. This function runs a list of deployment steps.

- Post-deployment Lambda

  There are certain actions that need to take place after the solution is deployed: add authentication providers (such as ADFS), add workflows and workflow templates, auto-generate JWT-signing key and store it in AWS Parameter Store, create a Root user, etc. This Lambda executes a list of pre-configured steps after deployment is complete. It's possible to register additional custom steps, if needed.
