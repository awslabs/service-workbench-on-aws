---
id: redeployment
title: Deploying Updates
sidebar_label: Deploying Updates
---

After a successful initial deployment, you can deploy individually to the five serverless projects that are a part of this solution. 

### Deploying Updates to the Infrastructure Serverless Project

```bash
$ cd solution/infrastructure
$ pnpx sls deploy -s <stage>
```

### Deploying Updates to the Backend Serverless Project

```bash
$ cd solution/backend
$ pnpx sls deploy -s <stage>
```

### Deploying Updates to the Machine-Images Serverless Project

```bash
$ cd solution/machine-images
$ pnpx sls deploy -s <stage>
```

### Deploying Updates to the Post-Deployment Serverless Project

```bash
$ cd solution/post-deployment
$ pnpx sls invoke local -f postDeployment --env WEBPACK_ON=true -s <stage>
```

### Deploying Updates to the UI Serverless Project

```bash
$ cd solution/ui
$ pnpx sls package-ui --stage <stage> --local
$ pnpx sls package-ui --stage <stage>
$ pnpx sls deploy-ui --stage <stage> --invalidate-cache
```