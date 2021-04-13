## Prerequisites

#### Tools

- Node 12
- [Hashicorp Packer](https://www.packer.io/)

#### Project variables

All variables in the settings will be added as -var parameters into the packer build command

## Usage

When installed as a [Serverless plugin](https://serverless.com/framework/docs/providers/aws/guide/plugins/), this provides the following CLI commands:

### `pnpx sls build-image -s <STAGE> [--file]`

By convention, this looks in the `./config/infra` directory for a json file that starts with packer. This file is then used by packer to build the AMI.

## Topics

- [Installing Packer](https://learn.hashicorp.com/tutorials/packer/getting-started-install)
- [Troubleshooting](https://learn.hashicorp.com/tutorials/packer/getting-started-install#troubleshooting)
