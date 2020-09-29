---
id: configuration
title: Configuration
sidebar_label: Configuration
---

**Note**: Configuration is optional. If deploying a simple installation,
the default configuration can be used.

## Stage Name

A stage name is used to allow multiple Service Workbench deployments from the same account. The stage name will be the name of the configuration files and also forms part of the name of the AWS resources created in this deployment. For limitations in the S3 buckets used for the deployment, the stage name should be no longer than 5 characters.

Decide on a **stage name**; for this example we will show this as `<stage>`. A common convention, if you are planning to deploy only once, is to use your login.

## Separately Deployable Components

Service Workbench code is divided into multiple (currently 7) _Separately Deployable Components_ (_SDCs_) with names such as `backend`, `ui`, `post-deployment`. Each SDC has a directory in `main/solution`. We will be running a script that deploys all SDCs in sequence, but they can each be deployed separately.

## Prepare Main Configuration File

**Note**: The currently active default profile will be used as the Main account during the deployment of Service Workbench, unless you create a configuration file, and include in it a setting for **awsProfile**. If you are deploying into an account other than that accessed through your default profile, you will need to create a configuration file and specify the profile accessing your desired Main account.

In this step you will make a copy of a sample global config file, name it for your stage, and modify it. Current default values for the main configuration are stored in `main/config/settings/.defaults.yml`. If no stage-named settings file is present, values will be read from this default file.

To create a custom (stage-named) settings file, in the directory `main/config/settings`, copy `example.yml` to `<stage>.yml` and then edit this new file. This is your stage configuration file. Default values are read from the default configuration file, .defaults.yml, unless overridden in this file. You may find some configuration settings are present in the default configuration file and not in example.yml, so read this file carefully. Below are some relevant settings in the default configuration file that you may wish to override in the stage configuration file, and their default values. See the default configuration file for more information.

### Configuration File Settings

Some of the most commonly-defined settings in the confguration file, and their defaults, are: 

**awsRegion**: `us-east-1`

**awsProfile**: No default; set this to your current AWS profile unless using a
default or instance profile.

**solutionName**: `sw`

**envName**: Same as stage name

**envType**: `prod`

**enableExternalResearchers**: `false`

To use a custom domain name, provide the following two values, the domain name itself, and the ARN for the manually-created TLS certificate to use from ACM. Note the current implementation assumes that DNS is handled elsewhere; a future improvement will automatically handle creation of the cert and Route53 entries.

**domainName**: `host.domain.toplevel`

**certificateArn**: `<ARN>`

## Namespace

The name of many deployed resources will include a namespace string such
as **mystage-va-sw**. This string is made up by concatenating:

- Environment name
- Region short name (eg: **va** for US-East-1, **or** for US-West-2, defined in `.defaults.yml`)
- Solution name

## Prepare SDC Configuration Files (Optional)

Each SDC has a `config/settings` directory, where customized settings files may be placed. Settings files are named after your stage name: `<mystagename.yml>`. Some of the SDC settings directories contain an `example.yml` file that may be copied and renamed as a settings file for that SDC. Otherwise, a default file `.defaults.yml` in that directory is read and used regardless of the stage name.
