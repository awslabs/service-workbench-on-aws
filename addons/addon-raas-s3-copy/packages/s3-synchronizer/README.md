# s3-synchronizer

This program polls the provided api URL to check for new s3 dataset information.
When a new dataset is specified, the program will copy the files to the local instance
(using a s3 multi-part download). If the JSON returned by the api specifies that this
dataset should be writable, the program will then setup file watchers and any file changes
will be persisted back to s3.

The program does not download any further changes to objects in s3 beyond the initial
download.

## Prerequisites

#### Tools

- Go 1.13.7+

## Usage

```bash
$ s3-synchronizer-darwin-amd64 -h
Usage of bin/s3-synchronizer-darwin-amd64:
  -defaultS3Mounts string
        A JSON string containing information about the default S3 mounts E.g., [{"id":"some-id","bucket":"some-s3-bucket-name","prefix":"some/s3/prefix/path","writeable":false,"kmsKeyId":"some-kms-key-arn"}] 
  -concurrency int
        The number of concurrent parts to download (default 20)
  -debug
        Whether to print debug information
  -destination string
        The directory to download to (default "./")
  -pollInterval int
        The delay (in seconds) between api http requests (default 60)
  -region string
        The aws region to use for the session (default "us-east-1")
  -profile string
        AWS Credentials profile. Default is no profile. The code will look for credentials in the following order: ENV variables, default credentials profile, EC2 instance metadata
```

## Building

```bash
$ ./build.sh
```
