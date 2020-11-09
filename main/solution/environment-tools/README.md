# Building Environment tools

This package is used to build and deploy tools and artifacts used in environments.

## Build and Packaging

```bash
$ pnpx sls build-go -s <stage>
```

## Deployment

```bash
$ pnpx sls deploy-go -s <stage>
```

## Overview of Lambda Functions

- None currently

## Overview of artifacts

- s3-synchronizer
  - A golang application used to sync files to and from the environment as directed by the solution.
