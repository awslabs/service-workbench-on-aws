---
id: configuration
title: Configuration
sidebar_label: Configuration
---

**Note**: Configuration is optional. If deploying a simple installation, the default configuration can be used.

## Stage Name

A stage name is used to allow multiple Service Workbench deployments from the same account. The stage name will be the name of the configuration files and also forms part of the name of the AWS resources created in this deployment. For limitations in the S3 buckets used for the deployment, the stage name should be no longer than 5 characters.

Decide on a **stage name**; for this example we will show this as `<stage>`. A common convention, if you are planning to deploy only once, is to use your login.

## Configuration Files

### Configuration File Structure

In the `main` directory at the top level of the source code tree, there is a directory path `config/settings`.  Configuration files in this directory are read when Service Workbench is deployed, and configuration changes made in these files apply throughout the solution.

The `settings` directory contains a file `.defaults.yml`, which is read when Service Workbench is deployed.  This file contains the settings for a default installation of Service Workbench.  If, in addition to the default configuration file, there is a file named after the stage name (`<stage>.yml`), this file is read and processed after the default file.  This stage-named file can be used to override settings established in the default configuration file.  A sample stage configuration file `example.yml` is provided as a template; copy or rename this file to your stage name for it to take effect.  You may find some configuration settings are present in the default file and not in the example file, so read these files carefully.

The same pattern, of a `config/settings` directory containing the file `.defaults.yml` (and optionally `<stage>.yml`), exists within each Separately Deployable Component (SDC) directory.  See below for how to configure each SDC.

**Note**: The currently active default profile will be used as the Main account during the deployment of Service Workbench, unless you create a configuration file, and include in it a setting for **awsProfile**. If you are deploying into an account other than that accessed through your default profile, you will need to create a configuration file and specify the profile accessing your desired Main account.

### Prepare Main Configuration File

In this step you will make a copy of a sample global configuration file, name it for your stage, and modify it.  In the directory `main/config/settings`, copy `example.yml` to `<stage>.yml` and then edit this new stage configuration file. Below are some relevant settings in the default configuration file that you may wish to override in the stage configuration file, and their default values. See the default configuration file for more information.

#### Configuration File Settings

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

### Namespace

The name of many deployed resources will include a namespace string such
as **mystage-va-sw**. This string is made up by concatenating:

- Environment name
- Region short name (eg: **va** for US-East-1, **or** for US-West-2, defined in `.defaults.yml`)
- Solution name

## Prepare SDC Configuration Files

Service Workbench code is divided into multiple _Separately Deployable Components_ (_SDCs_) with names such as `backend`, `ui`, `post-deployment`. Each SDC has a directory in `main/solution`. The main installatino script deploys all SDCs in sequence, but they can each be deployed separately.

Each SDC has a `config/settings` directory, where customized settings files may be placed, in the same way as the main setting file. Follow the procedure described above in **Configuration File Structure** to create and edit a configuration file for an SDC. Some of the SDC settings directories contain an `example.yml` file that may be copied and renamed as a settings file for that SDC.  A default file `.defaults.yml` in the settings directory is read prior to reading the stage configuration file.  Any settings in the stage configuration file override those in the default file.

If deploying in a non-default CLI profile, a stage settings file is necessary, containing in `awsProfile` the CLI profile with permissions for the desired account.

```{.sh}
    awsProfile: main-account-profile-name
```
