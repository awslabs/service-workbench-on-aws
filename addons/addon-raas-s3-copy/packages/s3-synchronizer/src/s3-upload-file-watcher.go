// Adapted from https://github.com/andymotta/s3-fsnotify-go
package main

import (
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go/service/s3"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/fsnotify/fsnotify"
)

func setupUploadWatcher(wg *sync.WaitGroup, sess *session.Session, config *mountConfiguration, stopUploadWatchersAfter int, debug bool) error {
	syncDir := config.destination
	bucket := config.bucket
	prefix := config.prefix
	kmsKeyId := config.kmsKeyId

	if debug {
		log.Println("syncDir: " + syncDir + " bucket: " + bucket + " prefix: " + prefix)
	}

	// This shouldn't happen, but make the directory if it doesn't exist
	if _, err := os.Stat(syncDir); os.IsNotExist(err) {
		os.MkdirAll(syncDir, os.ModePerm)
	}

	// Create a channel for sub directories that get added
	// These directories require explicit crawling to sync files up to S3 instead of just relying on file watcher
	// This is required to capture the following edge case:
	// 1. User directly creates a file and sub directories in one operation
	// 2. This will result in OS firing CREATE events for the sub directories and the file
	// 3. The code in processFileWatcherEvent will capture the CREATE event for the directories and attach
	//	   new file watchers
	// 4. The initial CREATE event of the file is never captured in this case because that event was fired
	//	  BEFORE we could complete registration of the file watchers for the created sub directories
	// To work around this timing issue, we need to enqueue these directories and crawl them after they are
	// registered for file watching. This crawling is for catch up of any files that existed in that directory
	//	before the watching began.
	dirRequiringCrawlCh := make(chan string, 1000)


	// There are two primary loops (running in go routines - similar to threads)
	// 1. THE MAIN LOOP: It takes care of starting new file watcher go routine everytime it receives a signal from "startNewWatcherLoopCh" channel below.
	//					 The main loop stops when it times out i.e., when stopUploadWatchersAfter time elapses (if applicable)
	//
	// 2. THE FILE WATCHER LOOP: It receives events from the directory watcher and reacts to those events.
	//							 The file watcher loop receives STOP signal from "stopWatcherLoopCh" channel below to stop.
	//							 A stop signal is pushed to "stopWatcherLoopCh" either due to timeout or
	//							 when the file watcher loop needs to be restarted with new directory watcher instance.
	startNewWatcherLoopCh := make(chan bool, 1)
	stopWatcherLoopCh := make(chan bool, 1000)

	addDirsToFileWatcher := func(watcher *dirWatcher) {
		// Watch the syncDir and all it's children directories
		err := filepath.Walk(
			syncDir,
			watchDirFactory(watcher, dirRequiringCrawlCh, debug))

		if err != nil {
			log.Printf("Error setting up file watcher: %v\n", err)
		}
	}

	processFileWatcherEvent := func(watcher *dirWatcher, event *fsnotify.Event) {
		if debug {
			log.Println("event:", event)
		}
		if event.Op&fsnotify.Rename == fsnotify.Rename || event.Op&fsnotify.Remove == fsnotify.Remove && !excludeFile(event.Name) {
			if debug {
				log.Println("renamed or deleted file:", event.Name)
			}

			if watcher.IsBeingWatched(event.Name) {
				if debug {
					log.Printf("\nDirectory being watched is renamed or deleted: %v\n\n", event.Name)
				}
				// Directory that was being watched is renamed or deleted
				// When dir is renamed event.Name has the dir's old name
				// Remove the directory from the file watcher
				watcher.UnwatchDir(event.Name)
				// If it's rename, it will also cause "Create" event for the dir with new name if the dir is moved
				// to a directory that is also monitored so delete the older directory from S3
				deleteDirFromS3(sess, syncDir, event.Name, bucket, prefix, debug)
			} else {
				// When file is renamed event.Name has the file's old name
				// Rename will also cause "Create" event for the file with new name if the file is moved
				// to a directory that is also monitored so delete old file from S3
				deleteFromS3(sess, syncDir, event.Name, bucket, prefix, debug)
			}

		} else if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create && !excludeFile(event.Name) {
			if debug {
				log.Println("modified file:", event.Name)
			}
			// First check that this is a file
			fi, err := os.Stat(event.Name)
			if err != nil && os.IsNotExist(err) {
				// We just received WRITE or CREATE event for the file but the file does not exist on the file system
				// This can happen on Windows when a folder is renamed and new file is created or modified in the
				// renamed folder
				// Somehow, windows generates CREATE/WRITE events for the file under the old path
				// For example, on Windows,
				// When you manually create a directory, it’s created as "New directory" first and then when
				// you rename it to say "d1" and add a file say "f1" to the directory, Windows generates file system
				// CREATE event for file "New directory\f1" instead of "d1\f1"

				if debug {
					log.Println("Received CREATE or WRITE event for ", event.Name, " but the file or directory does not exist. This can happen when directory is renamed on Windows. Stopping existing file watcher loop and starting a new one.")
				}

				// In this case restart the watcher and let it re-watch all the way from the root of the mount i.e., syncDir
				// Send stop signal to the loop running the current watcher
				if debug {
					log.Println("Sending STOP signal to existing file watcher loop")
				}
				stopWatcherLoopCh <- true
				if debug {
					log.Println("Sent STOP signal to existing file watcher loop")
				}

				// Send signal to start new watcher loop
				if debug {
					log.Println("Sending START signal to start new file watcher loop")
				}
				startNewWatcherLoopCh <- true
				if debug {
					log.Println("Sent START signal to start new file watcher loop")
				}

				return
			} else if err != nil {
				log.Println("Unable to stat file", err)
				return
			}

			if fi.Mode().IsDir() {
				if event.Op&fsnotify.Create == fsnotify.Create {
					if debug {
						log.Println(event.Name, "is a new directory, watching")
					}
					if err := filepath.Walk(
						event.Name,
						watchDirFactory(watcher, dirRequiringCrawlCh, debug),
					); err != nil {
						log.Println("Unable to watch directory", err)
					}
					return
				}
				if debug {
					log.Println(event.Name, "is a directory, skipping")
				}
				return
			}

			uploadToS3(sess, syncDir, event.Name, bucket, prefix, kmsKeyId, debug)
		}
	}

	uploadDir := func(watcher *dirWatcher, dirToUpload string, debug bool) {
		if debug {
			log.Println("Crawling directory", dirToUpload, "to upload file to s3 who may have been missed by file watcher")
		}
		if err := filepath.Walk(
			dirToUpload,
			func(path string, fi os.FileInfo, err error) error {
				if fi != nil && fi.Mode().IsDir() {
					if debug {
						log.Println(path, "is a new directory, watching")
					}
					if err := filepath.Walk(
						path,
						watchDirFactory(watcher, dirRequiringCrawlCh, debug),
					); err != nil {
						log.Println("Unable to watch directory", err)
					}
					return nil
				} else if fi != nil && !fi.Mode().IsDir() {
					if debug {
						log.Println("Uploading file", path, "to S3")
					}
					uploadToS3(sess, syncDir, path, bucket, prefix, kmsKeyId, debug)
					return nil
				}
				return nil
			},
		); err != nil {
			log.Println("Unable to upload directory", err)
		}
	}

	go func() {
	TheMainLoop:
		for {
			if stopUploadWatchersAfter > 0 {
				select {
				case <-time.After(time.Duration(stopUploadWatchersAfter) * time.Second):
					if debug {
						log.Printf("\n\n THE MAIN LOOP TIMEOUT \n\n")
					}
					break TheMainLoop
				case <-startNewWatcherLoopCh:
					if debug {
						log.Printf("\n\n RECEIVED SIGNAL TO START NEW FILE WATCHER \n\n")
					}
					watcher := NewDirWatcher(debug)
					go runFileWatcherLoop(wg, watcher, stopUploadWatchersAfter, &dirRequiringCrawlCh, uploadDir, debug, processFileWatcherEvent, &stopWatcherLoopCh)
					addDirsToFileWatcher(watcher)
				}
			} else {
				select {
				case <-startNewWatcherLoopCh:
					if debug {
						log.Printf("\n\n RECEIVED SIGNAL TO START NEW FILE WATCHER \n\n")
					}
					watcher := NewDirWatcher(debug)
					go runFileWatcherLoop(wg, watcher, stopUploadWatchersAfter, &dirRequiringCrawlCh, uploadDir, debug, processFileWatcherEvent, &stopWatcherLoopCh)
					addDirsToFileWatcher(watcher)
				}
			}
		}
	}()

	// Send signal to the channel to start new file watcher
	startNewWatcherLoopCh <- true

	return nil
}

func runFileWatcherLoop(wg *sync.WaitGroup, watcher *dirWatcher, stopAfter int, dirRequiringCrawlCh *chan string, uploadDir func(dw *dirWatcher, dirToUpload string, debug bool), debug bool, processFileWatcherEvent func(dw *dirWatcher, event *fsnotify.Event), stopLoopCh *chan bool) *chan bool {
	// Increment wait group counter everytime we spawn file upload watcher thread to make sure
	// the caller (main) can wait
	wg.Add(1)

	timeOut := func() {
		if debug {
			log.Printf("\n\n THE FILE WATCHER LOOP TIMEOUT \n\n")
		}
		*stopLoopCh <- true
		// Decrement from the wait group indicating we are done
		wg.Done()
	}

TheWatcherLoop:
	for {
		if stopAfter > 0 {
			select {
			case <-time.After(time.Duration(stopAfter) * time.Second):
				timeOut()
				break
			case <-*stopLoopCh:
				if debug {
					log.Printf("\n\n RECEIVED STOP SIGNAL IN THE FILE WATCHER LOOP \n\n")
				}
				// Stop the watcher and exit
				watcher.Stop()
				break TheWatcherLoop
			case dirToUpload := <-*dirRequiringCrawlCh:
				uploadDir(watcher, dirToUpload, debug)
			case event := <-watcher.FsEvents():
				processFileWatcherEvent(watcher, &event)
			case err := <-watcher.FsErrors():
				log.Println("error:", err)
				//log.Printf("\n\n WATCHER IS ALREADY STOPPED. EXITING THE WATCHER LOOP \n\n")
				//break TheWatcherLoop
			}
		} else {
			select {
			case <-*stopLoopCh:
				if debug {
					log.Printf("\n\n RECEIVED STOP SIGNAL IN THE FILE WATCHER LOOP \n\n")
				}
				// Stop the watcher and exit
				watcher.Stop()
				break TheWatcherLoop
			case dirToUpload := <-*dirRequiringCrawlCh:
				uploadDir(watcher, dirToUpload, debug)
			case event := <-watcher.FsEvents():
				processFileWatcherEvent(watcher, &event)
			case err := <-watcher.FsErrors():
				log.Println("error:", err)
				//log.Printf("\n\n WATCHER IS ALREADY STOPPED. EXITING THE WATCHER LOOP \n\n")
				//break TheWatcherLoop
			}
		}
	}
	return stopLoopCh
}

func deleteFromS3(sess *session.Session, syncDir string, filename string, bucket string, prefix string, debug bool) error {
	svc := s3.New(sess)
	fileKey := ToS3KeyForFile(filename, prefix, syncDir)
	deleteObjectInput := &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(fileKey)}
	_, err := svc.DeleteObject(deleteObjectInput)

	if err == nil {
		if debug {
			log.Println("Successfully deleted", filename, "from", bucket+"/"+fileKey)
		}
	} else {
		log.Println("Failed to delete object: ", err)
	}

	return err
}

func deleteDirFromS3(sess *session.Session, syncDir string, dirName string, bucket string, prefix string, debug bool) error {
	svc := s3.New(sess)

	// Add trailing slash for the dir name if it doesn't exist
	dirPrefixInS3 := filepath.ToSlash(dirName)
	if !strings.HasSuffix(dirPrefixInS3, "/") {
		dirPrefixInS3 = dirPrefixInS3 + "/"
	}
	dirKey := ToS3KeyForFile(dirPrefixInS3, prefix, syncDir)

	if debug {
		fmt.Printf("Deleting directory: %v from S3: %v\n", dirKey, bucket)
	}
	truncatedListing := true
	query := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(dirKey),
	}

	for truncatedListing {
		resp, err := svc.ListObjectsV2(query)

		if err != nil {
			log.Println("Failed to list objects: ", err)
			// 10 seconds backoff
			time.Sleep(time.Duration(10) * time.Second)
			continue
		}

		var objectIdentifiers []*s3.ObjectIdentifier
		// If the directory path is not empty in S3 then first delete all objects under the directory
		// (i.e., under the specific S3 suffix)
		if len(resp.Contents) > 0 {
			for _, item := range resp.Contents {
				objectIdentifiers = append(objectIdentifiers, &s3.ObjectIdentifier{Key: item.Key})
			}

			deleteObjectsInput := &s3.DeleteObjectsInput{
				Bucket: aws.String(bucket),
				Delete: &s3.Delete{
					Objects: objectIdentifiers,
				},
			}
			if debug {
				fmt.Printf("Deleting objects from old S3 path %v: %v\n", dirKey, deleteObjectsInput)
			}
			deleteObjectsResp, err := svc.DeleteObjects(deleteObjectsInput)
			if err != nil {
				log.Println("Failed to delete objects: ", err)
				return err
			}
			if len(deleteObjectsResp.Errors) > 0 && len(deleteObjectsResp.Deleted) > 0 {
				log.Println("Failed to delete some objects: ", deleteObjectsResp.Errors)
			}
			if len(deleteObjectsResp.Errors) > 0 && len(deleteObjectsResp.Deleted) == 0 {
				log.Println("Failed to delete objects: ", deleteObjectsResp)
				return errors.New(fmt.Sprintf("Failed to delete objects: %v\n", deleteObjectsResp.Errors))
			}
		}

		query.ContinuationToken = resp.NextContinuationToken
		truncatedListing = *resp.IsTruncated
	}

	keyToDelete := strings.TrimSuffix(dirKey, "/")
	deleteObjectInput := &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(keyToDelete)}
	_, err := svc.DeleteObject(deleteObjectInput)
	if err == nil {
		if debug {
			log.Println("Successfully deleted dir", keyToDelete, "from", bucket+"/"+keyToDelete)
		}
	} else {
		log.Println("Failed to delete dir ", keyToDelete, "from S3", err)
	}
	return err
}

func uploadToS3(sess *session.Session, syncDir string, filename string, bucket string, prefix string, kmsKeyId string, debug bool) error {
	file, err := os.Open(filename)
	if err != nil {
		log.Println("Unable to open file", err)
		return err
	}
	defer file.Close()
	uploader := s3manager.NewUploader(sess)

	fileKeyInS3 := ToS3KeyForFile(filename, prefix, syncDir)

	// Do NOT upload if there is no change in file size (bytes)
	// Without this there will be infinite loop between the downloader thread and the upload watcher thread as follows
	// Say, the file watcher is watching directory "A", the downloader thread syncs all files from S3 to "A"
	// This will trigger the file watcher events, the file watcher will upload them (if we don't check size)
	// The upload in S3 will cause the file's ETag to change even though there is no change in file's content
	// Due to this, the downloader thread will detect this as file update in S3 and download the file again
	// This will cause file change event in file watcher and so on...

	// Also, DO NOT upload file if the file is empty. The downloader thread on some platforms (e.g., on Windows) creates empty file on local file system first before writing stream of data from S3 to the file
	// The creation of the empty file will cause the file CREATE event to trigger and we will end up uploading empty file to S3 if we don't check for non-empty here.
	if areSizesDifferent(sess, bucket, fileKeyInS3, file) && !isEmptyFile(file) {
		var uploadInput *s3manager.UploadInput
		if strings.TrimSpace(kmsKeyId) == "" {
			uploadInput = &s3manager.UploadInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(fileKeyInS3),
				Body:   file,
				ACL:    aws.String(s3.ObjectCannedACLBucketOwnerFullControl),
			}
		} else {
			uploadInput = &s3manager.UploadInput{
				Bucket:               aws.String(bucket),
				Key:                  aws.String(fileKeyInS3),
				Body:                 file,
				ServerSideEncryption: aws.String("aws:kms"),
				SSEKMSKeyId:          aws.String(kmsKeyId),
				ACL:                  aws.String(s3.ObjectCannedACLBucketOwnerFullControl),
			}
		}

		// upload file to S3
		_, err = uploader.Upload(uploadInput)

		if err == nil {
			if debug {
				log.Println("Successfully uploaded", filename, "to", bucket+"/"+fileKeyInS3)
			}
		} else {
			log.Println("Unable to upload", filename, bucket, err)
		}

	} else {
		if debug {
			log.Println(filename, " size has not changed since last upload or the file is empty, skipping upload this time")
		}
	}

	return nil
}

// Checks if the file's sizes are different on disk and in S3
func areSizesDifferent(sess *session.Session, bucket string, fileKeyInS3 string, file *os.File) bool {
	query := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(fileKeyInS3),
	}
	svc := s3.New(sess)
	resp, err := svc.ListObjectsV2(query)
	if err != nil {
		log.Println("Failed to list objects: ", err)
		// 5 seconds backoff
		time.Sleep(time.Duration(5) * time.Second)
	}

	if len(resp.Contents) > 0 {
		item := resp.Contents[0] // Expecting only one element since we are doing ListObjectsV2 on specific object path

		fi, err := file.Stat()
		if err != nil {
			log.Printf("Failed to read file '%v' size, Error: %v\n", file.Name(), err)
			return true
		}
		return *item.Size != fi.Size()
	}

	return true
}

func isEmptyFile(file *os.File) bool {
	fi, err := file.Stat()
	if err != nil {
		log.Printf("Failed to read file '%v' size, Error: %v\n", file.Name(), err)
		return true
	}
	return !(fi.Size() > 0)
}

func watchDirFactory(watcher *dirWatcher, dirRequiringCrawlCh chan string, debug bool) func(path string, fi os.FileInfo, err error) error {
	return func(path string, fi os.FileInfo, err error) error {
		// since fsnotify can watch all the files in a directory, watchers only need
		// to be added to each nested directory
		if fi != nil && fi.Mode().IsDir() {
			if watcher.IsBeingWatched(path) {
				if debug {
					log.Println("Directory", path, "is already being watched. Skipping registration for watcher.")
				}
			} else {
				if debug {
					log.Println("Watching directory", path)
				}
				err := watcher.WatchDir(path)
				dirRequiringCrawlCh <- path
				return err
			}
		}
		return nil
	}
}

func excludeFile(path string) bool {
	// On Windows ignore the recycle bin
	if strings.HasPrefix(path, "$RECYCLE.BIN") {
		return true
	}
	var extension = filepath.Ext(path)
	switch extension {
	case ".swp":
		return true
	case ".tmp":
		return true
	default:
		return false
	}
}
