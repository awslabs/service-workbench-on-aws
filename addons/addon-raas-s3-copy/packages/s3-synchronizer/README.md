# s3-synchronizer

This program loads the S3 data on local file system by copying the data from S3 bucket based on the specified S3 mounts (i.e., `defaultS3Mounts`) JSON configuration.
If the `recurringDownloads` flag is set to `false`, the program will download data from S3 only once and further changes in S3 will not be synchronized locally.
If the `recurringDownloads` flag is set to `true`, the program will periodically (controlled by `downloadInterval`) synchronize the changes from S3 to local file system as follows.
- Any files present in S3 but not present locally will be downloaded
- Any existing files updated in S3 will be re-downloaded and local files will be overwritten. If the files had any local changes then those changes will be lost. 
  The program uses S3 object's `ETag` value to determine if the object has changed in S3 since the last download. 
  The program will re-download only updated files.
- Any files deleted from S3 but present locally will be deleted from local file system as well

`stopRecurringDownloadsAfter` can be passed to automatically stop recurring downloads after certain period. 

## Prerequisites

#### Tools

- Go 1.13.7+

## Usage

```bash
$ s3-synchronizer-darwin-amd64 -h
Usage of bin/s3-synchronizer-darwin-amd64:
  -defaultS3Mounts string
        A JSON string containing information about the default S3 mounts 
        E.g., [{"id":"some-id","bucket":"some-s3-bucket-name","prefix":"some/s3/prefix/path","writeable":false,"kmsKeyId":"some-kms-key-arn"}]
        The "writeable" is not implemented yet but supported in the JSON structure, for future.
  -concurrency int
        The number of concurrent parts to download (default 20)
  -debug
        Whether to print debug information
  -destination string
        The directory to download to (default "./")
  -recurringDownloads 
        Whether to periodically download changes from S3 (default false)
  -stopRecurringDownloadsAfter int
        Stop recurring downloads after certain number of seconds. ZERO or Negative value means continue indefinitely. (default -1 i.e., indefinitely)
  -downloadInterval int
        The interval at which to re-download changes from S3 in seconds. This is only applicable when recurringDownloads is true. (default 60).
        Note that this does not include the download time. This specifies the duration in seconds to wait before initiating the next download after the previous one completes.
  -region string
        The aws region to use for the session (default "us-east-1")
  -profile string
        AWS Credentials profile. Default is no profile. The code will look for credentials in the following order: ENV variables, default credentials profile, EC2 instance metadata
```

## Building

```bash
$ ./build.sh
```
