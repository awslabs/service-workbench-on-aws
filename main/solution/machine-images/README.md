# Building Machine Images


## Packer

This solution uses [Packer](https://www.packer.io/) to create an Amazon Machine Image (AMI). This AMI forms the basis for EC2/EMR environments that investigators use for their research.

To install Packer, please see their installation [instructions](https://www.packer.io/intro/getting-started/install.html).


## Preparation

For the RStudio image to function, a few files not in the repository need to be included in the build by placing them
in the `config/infra/files/rstudio` folder (note this folder is ignored by `git` to minimize the risk of files being
committed to source control).

*  `secret.txt`: A single-line text file that contains the JWT secret from the Galileo deployment, which can
   be found in Parameter Store at `/$stage/$solution/jwt/secret`, where `$stage` is the stage name for the
   environment and `$solution` is the solution name.

*  `cert.key`: The TLS private key in PEM format for the RStudio domain.

*  `cert.pem`: TLS certificate chain for the above in PEM format, with the intermediate certs first and the root last.

The current implementation assigns hostnames to RStudio instances with the form `rstudio-$env.$domain_name` where `$env`
is the environment identifier for the workspace, and `$domain_name` is the custom domain used for Galileo. This means that
the certificate above must be a wildcard certificate for `*.$domain_name`. It also means that Galileo must be deployed
with a custom domain for RStudio to work properly.


## Package and Deploy

To build Amazon Machine Images:

```bash
$ pnpx sls build-image -s $STAGE
```

Note that if no configuration is provided the default VPC will be used to create AMIs, and if
no default VPC exists AMI creation will fail. To instead provide a VPC and subnet to use,
create a `config/settings/$STAGE.yml` file with ID values (see `example.yml` for an example).
