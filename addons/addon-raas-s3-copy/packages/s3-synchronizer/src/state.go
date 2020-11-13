package main

import (
	"fmt"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/orcaman/concurrent-map"
)

type SynchronizerState interface {
	RecordFileDownloadToLocal(item *s3.Object)
	RecordFileDeletionFromLocal(filePath string, config *mountConfiguration)
	HasFileChangedInS3(item *s3.Object) bool
	IsFileDownloadedFromS3(filePath string, config *mountConfiguration) bool
	Clean() error
}

type persistentSynchronizerState struct {
	s3FileETagsMap cmap.ConcurrentMap
	persistence    Persistence
}

func NewPersistentSynchronizerState() SynchronizerState {
	persistence := NewFileBasedPersistenceWithJsonFormat("s3-synchronizer-state", "")
	synchronizerState := &persistentSynchronizerState{s3FileETagsMap: cmap.New(), persistence: persistence}

	err := synchronizerState.Load()
	if err != nil {
		// The initial load may fail if this is clean state and there is no state from any of the previous runs.
		// Just log and move on in this case
		fmt.Printf("Error loading synchronizerState from disk: %v", err)
	}
	return synchronizerState
}

func (state persistentSynchronizerState) Load() error {
	return state.persistence.Load(&state.s3FileETagsMap)
}

func (state persistentSynchronizerState) Save() error {
	return state.persistence.Save(&state.s3FileETagsMap)
}

func (state persistentSynchronizerState) Clean() error {
	return state.persistence.Clean()
}

func (state persistentSynchronizerState) RecordFileDownloadToLocal(item *s3.Object) {
	state.s3FileETagsMap.Set(*item.Key, *item.ETag)

	// Keep saving after each change
	state.Save()
}

// Returns flag indicating if the given file was downloaded from S3 (as opposed to created locally)
func (state persistentSynchronizerState) IsFileDownloadedFromS3(filePath string, config *mountConfiguration) bool {
	s3Key := ToS3Key(filePath, config)

	_, exists := state.s3FileETagsMap.Get(s3Key)

	// If the entry for the given file exists in the state.s3FileETagsMap then it means this file was downloaded from S3
	return exists
}

func (state persistentSynchronizerState) RecordFileDeletionFromLocal(filePath string, config *mountConfiguration) {
	s3Key := ToS3Key(filePath, config)

	// Delete ETag from cache map when file is deleted from local machine
	state.s3FileETagsMap.Remove(s3Key)

	// Keep saving after each change
	state.Save()
}

func (state persistentSynchronizerState) HasFileChangedInS3(item *s3.Object) bool {
	// Return true if the S3 object's ETag is different than the one we have
	// in our map
	existing, ok := state.s3FileETagsMap.Get(*item.Key)
	return ok && existing.(string) != *item.ETag
}
