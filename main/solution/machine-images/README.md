# Building Machine Images

## Packer

This solution uses [Packer](https://www.packer.io/) to create an Amazon Machine Image (AMI). This AMI forms the basis for EC2/EMR environments that investigators use for their research.

To install Packer, please see their installation [instructions](https://www.packer.io/intro/getting-started/install.html).

## Package and Deploy

To build Amazon Machine Images:

```bash
$ pnpx sls build-image -s $STAGE
```

Note that if no configuration is provided the default VPC will be used to create AMIs, and if
no default VPC exists AMI creation will fail. To instead provide a VPC and subnet to use,
create a `config/settings/$STAGE.yml` file with ID values (see `example.yml` for an example).
