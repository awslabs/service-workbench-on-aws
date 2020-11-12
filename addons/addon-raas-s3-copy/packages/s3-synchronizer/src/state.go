package main

import (
	"fmt"
	"github.com/aws/aws-sdk-go/service/s3"
)

type SynchronizerState interface {
	recordFileDownloadToLocal(item *s3.Object)
	recordFileDeletionFromLocal(filePath string, config *mountConfiguration)
	hasFileChangedInS3(item *s3.Object) bool
	isFileDownloadedFromS3(filePath string, config *mountConfiguration) bool
}

type persistentSynchronizerState struct {
	s3FileETagsMap map[string]string
	persistence    Persistence
}

func NewPersistentSynchronizerState() SynchronizerState {
	persistence := NewFileBasedPersistenceWithJsonFormat("s3-synchronizer-state", "")
	synchronizerState := &persistentSynchronizerState{s3FileETagsMap: make(map[string]string), persistence: persistence}

	err := synchronizerState.load()
	if err != nil {
		// The initial load may fail if this is clean state and there is no state from any of the previous runs.
		// Just log and move on in this case
		fmt.Printf("Error loading synchronizerState from disk: %v", err)
	}
	return synchronizerState
}

func (state persistentSynchronizerState) load() error {
	return state.persistence.Load(&state.s3FileETagsMap)
}

func (state persistentSynchronizerState) save() error {
	return state.persistence.Save(&state.s3FileETagsMap)
}

func (state persistentSynchronizerState) recordFileDownloadToLocal(item *s3.Object) {
	state.s3FileETagsMap[*item.Key] = *item.ETag

	// Keep saving after each change
	state.save()
}

// Returns flag indicating if the given file was downloaded from S3 (as opposed to created locally)
func (state persistentSynchronizerState) isFileDownloadedFromS3(filePath string, config *mountConfiguration) bool {
	s3Key := ToS3Key(filePath, config)

	_, exists := state.s3FileETagsMap[s3Key]

	// If the entry for the given file exists in the state.s3FileETagsMap then it means this file was downloaded from S3
	return exists
}

func (state persistentSynchronizerState) recordFileDeletionFromLocal(filePath string, config *mountConfiguration) {
	s3Key := ToS3Key(filePath, config)

	// Delete ETag from cache map when file is deleted from local machine
	delete(state.s3FileETagsMap, s3Key)

	// Keep saving after each change
	state.save()
}

func (state persistentSynchronizerState) hasFileChangedInS3(item *s3.Object) bool {
	// Return true if the S3 object's ETag is different than the one we have
	// in our map
	return state.s3FileETagsMap[*item.Key] != *item.ETag
}
