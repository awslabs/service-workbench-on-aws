// Adapted from https://github.com/andymotta/s3-fsnotify-go
package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/fsnotify/fsnotify"
)

func setupUploadWatcher(sess *session.Session, config *mountConfiguration, debug bool) error {
	syncdir := config.destination
	bucket := config.bucket
	prefix := config.prefix
	kmsKeyId := config.kmsKeyId

	if debug {
		log.Println("syncdir: " + syncdir + " bucket: " + bucket + " prefix: " + prefix)
	}
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer watcher.Close()

	// This shouldn't happen, but make the directory if it doesn't exist
	if _, err := os.Stat(syncdir); os.IsNotExist(err) {
		os.MkdirAll(syncdir, os.ModePerm)
	}

	// We have to stop this thread from exiting
	done := make(chan bool)
	go func() {
		for {
			select {
			case event := <-watcher.Events:
				if debug {
					log.Println("event:", event)
				}
				if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create && !excludeFile(event.Name) {
					if debug {
						log.Println("modified file:", event.Name)
					}
					// First check that this is a file
					fi, err := os.Stat(event.Name)
					if err != nil {
						log.Println("Unable to stat file", err)
						continue
					}

					if fi.Mode().IsDir() {
						if event.Op&fsnotify.Create == fsnotify.Create {
							if debug {
								log.Println(event.Name, "is a new directory, watching")
							}
							if err := filepath.Walk(
								filepath.Join(syncdir, event.Name),
								watchDirFactory(watcher, debug),
							); err != nil {
								log.Println("Unable to watch directory", err)
							}
							continue
						}
						if debug {
							log.Println(event.Name, "is a directory, skipping")
						}
						continue
					}

					uploadToS3(sess, syncdir, event.Name, bucket, prefix, kmsKeyId, debug)
				}

			case err := <-watcher.Errors:
				log.Println("error:", err)
			}
		}
	}()

	err = watcher.Add(syncdir)
	if err != nil {
		log.Printf("Error setting up file watcher: " + err.Error())
	}

	<-done
	// We will never get to here
	return nil
}

func uploadToS3(sess *session.Session, syncdir string, filename string, bucket string, prefix string, kmsKeyId string, debug bool) error {
	file, err := os.Open(filename)
	if err != nil {
		log.Println("Unable to open file", err)
		return err
	}
	defer file.Close()
	key := strings.TrimPrefix(filename, syncdir)
	uploader := s3manager.NewUploader(sess)
	_, err = uploader.Upload(&s3manager.UploadInput{
		Bucket:               aws.String(bucket),
		Key:                  aws.String(prefix + "/" + filepath.ToSlash(key)),
		Body:                 file,
		ServerSideEncryption: aws.String("aws:kms"),
		SSEKMSKeyId:          aws.String(kmsKeyId),
	})
	if err != nil {
		log.Println("Unable to upload", filename, bucket, err)
	}
	if debug {
		log.Println("Successfully uploaded", filename, "to", bucket+"/"+prefix+"/"+key)
	}
	return nil
}

func watchDirFactory(watcher *fsnotify.Watcher, debug bool) func(path string, fi os.FileInfo, err error) error {
	return func(path string, fi os.FileInfo, err error) error {

		// since fsnotify can watch all the files in a directory, watchers only need
		// to be added to each nested directory
		if fi.Mode().IsDir() {
			if debug {
				log.Println("Watching directory", path)
			}
			return watcher.Add(path)
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
