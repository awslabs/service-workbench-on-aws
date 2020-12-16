---
id: configuration
title: Configuration
sidebar_label: Configuration
---

_**Note**: Setting the configuration is required. If you are deploying a simple installation, you can use the default configuration._

## Stage Name

A **Stage Name** is used to allow multiple Service Workbench deployments from the same account. The **Stage Name** will be the name of the configuration files and forms part of the name of the AWS resources created in this deployment. For limitations in [Amazon Simple Storage Service (Amazon S3)](https://aws.amazon.com/s3/) deployment buckets, the **Stage Name** should not be longer than 5 characters. Buckets are the fundamental containers in Amazon S3 for data storage.

You can select your own **Stage Name**; if you are planning to deploy the solution only once, a common convention, is to use your own login. In the following sections of the guide, customized **Stage Name** is represented as `<stage>`.

## Separately Deployable Components

The Service Workbench code is divided into multiple (currently 7) Separately Deployable Components (SDCs) with names such as **backend**, **UI**, **post-deployment**, **edge-lambda**, **infrastructure**, **machine-images**, and **prepare-aster-acc**. Each SDC has a directory in the location, `main/solution`. While you can run the script that’s located in the root folder of the project that deploys all SDCs in a sequence, you can also deploy each SDC separately using individual scripts.

## Prepare Main Configuration File

You can make a copy of the sample global config file, name it for your stage, and modify it. The current default values for the main configuration are stored in the default file in the directory, `main/config/settings/.defaults.yml`. If the stage-named settings file is not available, the values are read from this default file.

To create a custom (stage-named) settings file, in the directory, `main/config/settings`, copy `example.yml` to `<stage>.yml` and edit this new file. Default values are read from `.defaults.yml` unless the values are overridden in this file and have the values described in **Table 2**.

| **Configuration**         |    **Value**                                                                                    |
| :------------------------ | :---------------------------------------------------------------------------------------------- |
| awsRegion                 |    `us-east-1`                                                                                  |
| awsProfile                |    No default; set this to your current AWS profile unless using a default or instance profile. |
| solutionName              |    `sw`                                                                                         |
| envName                   |    Same as stage name.                                                                          |
| envType                   |    `prod`                                                                                       |
| enableExternalResearchers |    `false`                                                                                      |
**_Table 2: Configuration Values_**


## (Optional) Custom Domain names

To use a custom domain name, provide the following two values, (1) the domain name itself (2) the ARN for the manually-created TLS certificate to use from ACM.

```
domainName: `host.domain.toplevel`

certificateArn: `<ARN>`
```
_**Note**: The current implementation assumes that DNS is handled elsewhere; a future improvement will automatically handle creation of the cert and Route53 entries._

## Namespace

The name of many deployed resources include a namespace string such
as `mystage-va-sw`. This string is made up by concatenating the following:

- Environment name
- Region short name (eg: `va` for US-East-1, `or` for US-West-2,
  defined in `.defaults.yml`)
- Solution name

## (Optional) Prepare SDC Configuration Files 

Each SDC has a `config/settings` directory, where you can place customized settings. Settings files are named after your **Stage Name**: `<mystagename.yml>`. Some of the SDC settings directories contain an `example.yml` file that may be copied and renamed as a settings file for that SDC. Otherwise, a default file `.defaults.yml` in that directory is read and used regardless of the **Stage Name**.
