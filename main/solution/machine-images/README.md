# Building Machine Images

## Packer

This solution uses [Packer](https://www.packer.io/) to create an Amazon Machine Image (AMI). This AMI forms the basis for EC2/EMR environments that investigators use for their research.

To install Packer 1.6.0, use [pkenv](https://github.com/iamhsa/pkenv).

## Note for RStudio

Support for the legacy version of RStudio has now been deprecated. The AMI and Service Catalog template for a new version of RStudio (RStudioV2) can be integrated by following the steps mentioned in AWS partner's [repository](https://github.com/RLOpenCatalyst/Service_Workbench_Templates). For more information about new RStudio enhancements, refer to the "Create RStudio ALB workspace" section of *Service Workbench Post Deployment Guide*.

## Package and Deploy

To build Amazon Machine Images:

```bash
$ pnpx sls build-image -s $STAGE
```

Note that if no configuration is provided the default VPC will be used to create AMIs, and if
no default VPC exists AMI creation will fail. To instead provide a VPC and subnet to use,
create a `config/settings/$STAGE.yml` file with ID values (see `example.yml` for an example).
