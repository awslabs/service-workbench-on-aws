package main

import (
	"path/filepath"
	"strings"
)

// Use pointers in this struct so its easy to tell if a value was not in JSON (ie the ptr is nil)
type s3Mount struct {
	Id        *string `json:"id,omitempty"`
	Bucket    *string `json:"bucket,omitempty"`
	Prefix    *string `json:"prefix,omitempty"`
	Writeable *bool   `json:"writeable,omitempty"`
	KmsArn    *string `json:"kmsArn,omitempty"`
	RoleArn   *string `json:"roleArn,omitempty"`
}

func mountToString(mount *s3Mount) string {
	return *mount.Bucket + *mount.Prefix + *mount.Id
}

func Bool(v bool) *bool       { return &v }
func String(v string) *string { return &v }

// Returns S3 object key based on file path and mountConfiguration
func ToS3Key(filePath string, config *mountConfiguration) string {
	return ToS3KeyForFile(filePath, config.prefix, config.destination)
}

// Returns S3 object key based on file path, prefix and sync dir
func ToS3KeyForFile(filePath string, prefix string, syncDir string) string {
	// if prefix ends with trailing slash then remove extra slash
	s3Prefix := filepath.ToSlash(prefix)
	if strings.HasSuffix(s3Prefix, "/") {
		s3Prefix = strings.TrimSuffix(s3Prefix, "/")
	}

	normalizedSyncDir := filepath.ToSlash(syncDir)
	normalizedFilePath := filepath.ToSlash(filePath)
	s3FilePath := strings.TrimPrefix(normalizedFilePath, normalizedSyncDir)
	// if s3 file path starts with a trailing slash then remove extra slash
	if strings.HasPrefix(s3FilePath, "/") {
		s3FilePath = strings.TrimPrefix(s3FilePath, "/")
	}

	s3Key := filepath.ToSlash(s3Prefix + "/" + s3FilePath)
	return s3Key
}
