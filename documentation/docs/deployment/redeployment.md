---
id: redeployment
title: Deploying Updates
sidebar_label: Deploying Updates
---

Following an initial successful deployment, you can subsdequently deploy individually to the 5 serverless projects that are part of this solution.

## Deploying Updates to the Infrastructure Serverless Project

```bash
$ cd solution/infrastructure
$ pnpx sls deploy -s <stage>
```

## Deploying Updates to the Backend Serverless Project

```bash
$ cd solution/backend
$ pnpx sls deploy -s <stage>
```

## Deploying Updates to the Machine-Images Serverless Project

```bash
$ cd solution/machine-images
$ pnpx sls deploy -s <stage>
```

## Deploying Updates to the Post-Deployment Serverless Project

```bash
$ cd solution/post-deployment
$ pnpx sls invoke local -f postDeployment --env WEBPACK_ON=true -s <stage>
```

## Deploying Updates to the UI Serverless Project

```bash
$ cd solution/ui
$ pnpx sls package-ui --stage <stage> --local
$ pnpx sls package-ui --stage <stage>
$ pnpx sls deploy-ui --stage <stage> --invalidate-cache
```