package main

import "encoding/json"

// A function that returns default S3 mounts information based on the given "defaultS3Mounts"
// The "defaultS3Mounts" is expected to be in valid JSON Array format with each array element containing the following attributes
// 	id: A unique identifier of
//	bucket: Name of the S3 bucket to load data from
//	prefix: The S3 prefix path to load data from
//	writeable: Optional boolean flag indicating if the specified S3 prefix location should be treated as writeable or READ-only. Default is false.
//	kmsKeyId: Optional, KMS Key ARN. Default is empty string. NOTE: This attribute is not used by the program at the moment. The program assumes S3 being configured with default server side encryption.
func getDefaultMounts(defaultS3Mounts string) (*[]s3Mount, error) {
	mounts := make([]s3Mount, 0)

	err := json.Unmarshal([]byte(defaultS3Mounts), &mounts)
	// Set defaults for any optional parameters not set in JSON
	for i, mount := range mounts {
		if mount.Writeable == nil {
			mounts[i].Writeable = Bool(false)
		}
		if mount.KmsArn == nil {
			emptyString := ""
			mounts[i].KmsArn = &emptyString
		}
		if mount.RoleArn == nil {
		    emptyString := ""
		    mounts[i].RoleArn = &emptyString
		}
	}
	return &mounts, err
}
