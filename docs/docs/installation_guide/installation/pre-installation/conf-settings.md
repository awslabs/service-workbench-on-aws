---
id: conf-settings
title: Configuration settings
sidebar_label: Configuration settings
---
### Stage name

A stage name is used to allow multiple Service Workbench deployments from the same account. It represents the name of the configuration files. For limitations in Amazon Simple Storage Service ([Amazon S3](https://aws.amazon.com/s3/)) deployment buckets, the stage name must not be longer than five characters. Buckets are the fundamental containers in Amazon S3 for data storage.
You can select your own stage name. If you are planning to deploy the solution only once, a common convention, is to use your own login. In the following sections of the guide, customized stage name is represented as `<stage>`.

### Separately deployable components

The Service Workbench code is divided into multiple (currently seven) separately deployable components (SDCs): backend, UI, post-deployment, edge-lambda, infrastructure, machine-images, and prepare-aster-acc. Each SDC has a directory in the location, main/solution. You can run the script either from the root directory or also deploy each SDC separately using individual scripts.  For more information, see  [serverless framework and projects](/installation_guide/components).

### Prepare the main configuration file

You can make a copy of the sample global AWS Config file, name it for your stage, and modify it. The current default values for the main configuration are stored in the default file in the directory, `main/config/settings/.defaults.yml`. If the stage-named settings file is not available, the values are read from this default file.

To create a custom (stage-named) settings file, in the directory, `main/config/settings`, copy `example.yml` to `<stage>.yml` and edit this new file. Default values are read from `.defaults.yml` unless the values are overridden in this file. Following table describes the default values: 

| Configuration      | Value | 
| ----------- | ----------- |
| `awsRegion`      | `us-east-1`       |
| `awsProfile`   | No default; set this to your current AWS profile unless using a default or instance profile.        |
| `solutionName`      | `sw`       |
| `envName`   | Same as stage name        |
| `envType`      | `prod`       |
| `enableExternalResearchers`   | `false`        |

### Custom domain names

To use a custom domain name, enter the domain name and the ARN for the manually created TLS certificate.
```
domainName: host.domain.toplevel
certificateArn: <ARN>
```
**Note**: The current implementation assumes that DNS is handled elsewhere. A future improvement will automatically handle creation of the cert and Route 53 entries.
**Note**: This is an optional step during Service Workbench installation.

### Namespace

The names of many deployed resources include a namespace string such as `mystage-va-sw`. This string is made by concatenating the following:

+ Environment name
+ Region short name (for example: `va` for US-East-1, or for US-West-2, defined in `.defaults.yml`)
+ Solution name

### Prepare SDC configuration files

Each SDC has a `config/settings` directory, where you can place customized settings. Settings files are named after the stage name `<mystagename.yml>`. Some of the SDC settings directories contain an `example.yml` file that may be copied and renamed as a settings file for that SDC. Otherwise, a default file `.defaults.yml` in that directory is read and used regardless of the stage name.

**Note**: This is an optional step during Service Workbench installation.

### Accessing the Service Workbench source code

Download the latest source code by using [this link](https://github.com/awslabs/service-workbench-on-aws/tags) and run the following command:
`curl -o serviceworkbench.zip <URL>`

**Note**: Setting the configuration is required. If you are deploying an installation, you can use the default configuration.

### Supported regions

The following regions support all the AWS services and features needed to run Service Workbench:
+ US East (Ohio)
+ US East (N. Virginia)
+ US West (N. California)
+ US West (Oregon)
+ Asia Pacific (Mumbai)
+ Asia Pacific (Seoul)
+ Asia Pacific (Singapore)
+ Asia Pacific (Sydney)
+ Asia Pacific (Tokyo)
+ Canada (Central)
+ Europe (Frankfurt)
+ Europe (Ireland)
+ Europe (London)
+ Europe (Paris)
+ Europe (Stockholm)
+ South America (São Paulo)

