package main

// Use pointers in this struct so its easy to tell if a value was not in JSON (ie the ptr is nil)
type s3Mount struct {
	Id        *string `json:"id,omitempty"`
	Bucket    *string `json:"bucket,omitempty"`
	Prefix    *string `json:"prefix,omitempty"`
	Writeable *bool   `json:"writeable,omitempty"`
	KmsKeyId  *string `json:"kmsKeyId,omitempty"`
}

func mountToString(mount *s3Mount) string {
	return *mount.Bucket + *mount.Prefix + *mount.Id
}

func Bool(v bool) *bool       { return &v }
func String(v string) *string { return &v }
