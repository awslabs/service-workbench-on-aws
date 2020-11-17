// Adapted from https://github.com/andymotta/s3-fsnotify-go
package main

import (
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
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	// This shouldn't happen, but make the directory if it doesn't exist
	if _, err := os.Stat(syncDir); os.IsNotExist(err) {
		os.MkdirAll(syncDir, os.ModePerm)
	}

	// Increment wait group counter everytime we spawn file upload watcher thread to make sure
	// the caller (main) can wait
	wg.Add(1)

	continueFileUploadWatcher := true

	// Create a channel for sub directories that get added
	// These directories require explicit crawling to sync files up to S3 instead if just relying on file watcher
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
	go func() {

		processFileWatcherEvent := func(event *fsnotify.Event) {
			if debug {
				log.Println("event:", event)
			}
			if event.Op&fsnotify.Rename == fsnotify.Rename && !excludeFile(event.Name) {
				if debug {
					log.Println("rename file:", event.Name)
				}
				// When file is renamed event.Name has the file's old name
				// Rename will also cause "Create" event for the file with new name if the file is moved
				// to a directory that is also monitored
				deleteFromS3(sess, syncDir, event.Name, bucket, prefix, debug)
			} else if event.Op&fsnotify.Remove == fsnotify.Remove && !excludeFile(event.Name) {
				if debug {
					log.Println("deleted file:", event.Name)
				}
				deleteFromS3(sess, syncDir, event.Name, bucket, prefix, debug)
			} else if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create && !excludeFile(event.Name) {
				if debug {
					log.Println("modified file:", event.Name)
				}
				// First check that this is a file
				fi, err := os.Stat(event.Name)
				if err != nil {
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

		uploadDir := func(dirToUpload string, debug bool) {
			if debug {
				log.Println("Crawling directory", dirToUpload, "to upload file to s3 who may have been missed by file watcher")
			}
			if err := filepath.Walk(
				dirToUpload,
				func(path string, fi os.FileInfo, err error) error {
					if fi != nil && !fi.Mode().IsDir() {
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

		timeOut := func() {
			continueFileUploadWatcher = false

			// Decrement from the wait group indicating we are done
			wg.Done()

			// Close the watcher once we are done watching file changes
			watcher.Close()
		}

		for continueFileUploadWatcher {
			if stopUploadWatchersAfter > 0 {
				select {
				case <-time.After(time.Duration(stopUploadWatchersAfter) * time.Second):
					timeOut()
					break
				case dirToUpload := <-dirRequiringCrawlCh:
					uploadDir(dirToUpload, debug)
				case event := <-watcher.Events:
					processFileWatcherEvent(&event)
				case err := <-watcher.Errors:
					log.Println("error:", err)
				}
			} else {
				select {
				case event := <-watcher.Events:
					processFileWatcherEvent(&event)
				case dirToUpload := <-dirRequiringCrawlCh:
					uploadDir(dirToUpload, debug)
				case err := <-watcher.Errors:
					log.Println("error:", err)
				}
			}
		}
	}()

	// Watch the syncDir and all it's children directories
	err = filepath.Walk(
		syncDir,
		watchDirFactory(watcher, dirRequiringCrawlCh, debug))

	if err != nil {
		log.Printf("Error setting up file watcher: " + err.Error())
	}

	return nil
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
				Bucket:               aws.String(bucket),
				Key:                  aws.String(fileKeyInS3),
				Body:                 file,
				ServerSideEncryption: aws.String("aws:kms"),
				ACL:                  aws.String(s3.ObjectCannedACLBucketOwnerFullControl),
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

func watchDirFactory(watcher *fsnotify.Watcher, dirRequiringCrawlCh chan string, debug bool) func(path string, fi os.FileInfo, err error) error {
	return func(path string, fi os.FileInfo, err error) error {

		// since fsnotify can watch all the files in a directory, watchers only need
		// to be added to each nested directory
		if fi != nil && fi.Mode().IsDir() {
			if debug {
				log.Println("Watching directory", path)
			}
			err := watcher.Add(path)
			dirRequiringCrawlCh <- path
			return err
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
