package main

import (
	"fmt"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/fsnotify/fsnotify"
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
	// Return true is the file was never downloaded from S3 (could happen when the file originated from local machine)
	// and was uploaded to S3 but was never downloaded from S3 OR
	// Return true if the S3 object's ETag is different than the one we have in our map since the last download
	existing, ok := state.s3FileETagsMap.Get(*item.Key)

	return !ok || existing.(string) != *item.ETag
}

// State hold map of directory path vs flag indicating if it is being watched by file watchers
type dirWatcher struct {
	dirWatchersMap cmap.ConcurrentMap
	fsWatcher      *fsnotify.Watcher
	initError      error
	debug          bool
}

func (dw dirWatcher) WatchDir(dirPath string) error {
	if !dw.IsBeingWatched(dirPath) {
		dw.dirWatchersMap.Set(dirPath, true)
		return dw.fsWatcher.Add(dirPath)
	}
	return nil
}

func (dw dirWatcher) FsEvents() chan fsnotify.Event {
	return dw.fsWatcher.Events
}
func (dw dirWatcher) FsErrors() chan error {
	return dw.fsWatcher.Errors
}
func (dw dirWatcher) UnwatchDir(dirPath string) error {
	if dw.IsBeingWatched(dirPath) {
		dw.dirWatchersMap.Remove(dirPath)
		return dw.fsWatcher.Remove(dirPath)
	}
	return nil
}

func (dw dirWatcher) IsBeingWatched(dirPath string) bool {
	return dw.dirWatchersMap.Has(dirPath)
}

func (dw dirWatcher) Stop() error {
	return dw.fsWatcher.Close()
}

func (dw dirWatcher) InitializedSuccessfully() bool {
	return dw.initError == nil
}

func (dw dirWatcher) InitError() error {
	return dw.initError
}

func NewDirWatcher(debug bool) *dirWatcher {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return &dirWatcher{initError: err}
	}
	return &dirWatcher{dirWatchersMap: cmap.New(), fsWatcher: watcher, initError: nil, debug: debug}
}
