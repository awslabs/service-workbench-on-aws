# serverless-go-build-tools

This package is a Serverless plugin that will build golang code and upload it to S3.

### Prerequisites

#### Tools

- Node 12.x or later
- Go 1.13.7 or later

## Configuration

This Serverless plugin expects to have custom configuration in the serverless.yml as in the following
example:

```
custom:
  goBuilds:
    - name: <friendly name>
      packagePath: <the path to the package>
      sourceDirectory: <the location of the source files to build (default './')>
      outputPrefix: <the build output prefix (default 'bin/')>
      buildOptions: <build options to use (default '')>
      architectures: <an array of architectures to build>
      operatingSystems: <an array of operating systems to target>
      destinationBucket: <the destination bucket>
      destinationPrefix: <the prefix for artifacts in the bucket>
```

## Usage

This tool will build and deploy the golang targets after deployment. This functionality can be disabled:
`sls deploy --nogobuild=true -s <STAGE>`.

When installed as a [Serverless plugin](https://serverless.com/framework/docs/providers/aws/guide/plugins/), this provides the following CLI commands:

### `pnpx sls build-go -s <STAGE>`

This will just build the targets specified in the configuration

### `pnpx sls deploy-go -s <STAGE>`

This command will build the targets specified and then upload the artifacts to S3.
