---
id: configuration
title: Configuration
sidebar_label: Configuration
---

**Note**: Configuration is optional. If deploying a simple installation,
the default configuration can be used.

## Stage Name

A stage name is used to allow multiple Service Workbench deployments from the same
account. The stage name will be the name of the configuration files and
also forms part of the name of the AWS resources created in this
deployment. For limitations in the S3 buckets used for the deployment, the stage name should be no longer than 5 characters.

Decide on a **stage name**; for this example we will show this as
`<stage>`. A common convention, if you are planning to deploy only
onece, is to use your login.

## Separately Deployable Components

Service Workbench code is divided into multiple (currently 7) _Separately
Deployable Components_ (_SDCs_) with names such as `backend`, `ui`,
`post-deployment`. Each SDC has a directory in `main/solution`. We will
be running a script that deploys all SDCs in sequence, but they can each
be deployed separately.

## Prepare Main Configuration File

In this optional step you will make a copy of a sample global config
file, name it for your stage, and modify it. Current default values for
the main configuration are stored in
`main/config/settings/.defaults.yml`. If no stage-named settings file is
present, values will be read from this default file.

To create a custom (stage-named) settings file, in the directory
`main/config/settings` copy `example.yml` to `<stage>.yml` and then edit
this new file. Default values are read from `.defaults.yml` unless
overridden in this file and have the following values:

**awsRegion**

: `us-east-1`

**awsProfile**

: No default; set this to your current AWS profile unless using a
default or instance profile.

**solutionName**

: `sw`

**envName**

: Same as stage name

**envType**

: `prod`

**enableExternalResearchers**

: `false`

## Custom Domain names

To use a custom domain name, provide the following two values, the domain name
itself, and the ARN for the manually-created TLS certificate to use from ACM.
Note the current implementation assumes that DNS is handled elsewhere; a future
improvement will automatically handle creation of the cert and Route53 entries.

domainName: `host.domain.toplevel`

certificateArn: `<ARN>`

## Namespace

The name of many deployed resources will include a namespace string such
as `mystage-va-sw`. This string is made up by concatenating:

- Environment name
- Region short name (eg: `va` for US-East-1, `or` for US-West-2,
  defined in `.defaults.yml`)
- Solution name

## Prepare SDC Configuration Files

Each SDC has a `config/settings` directory, where customized settings files may be placed, in the same way as the main setting file.  Settings files are named after the stage name: `<stage>.yml`.  Some of the SDC settings directories contain an `example.yml` file that may be copied and renamed as a settings file for that SDC.  A default file `.defaults.yml` in the settings directory is read prior to reading the stage configuration file.  Any settings in the stage configuration file override those in the default file.

If deploying in a non-default profile, a stage settings file is necessary, containing in `awsProfile` the profile with permissions for the desired account.

```{.sh}
    awsProfile: main-account-profile-name
```