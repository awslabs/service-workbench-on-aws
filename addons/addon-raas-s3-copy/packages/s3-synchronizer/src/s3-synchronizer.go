package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"log"
	"path/filepath"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
)

func main() {
	defaultS3Mounts, region, profile, destinationBase, concurrency, recurringDownloads, stopRecurringDownloadsAfter, downloadInterval, debug, err := readConfigFromArgs()
	if err != nil {
		log.Fatal(err)
	}

	sess := makeSession(profile, region)

	// Passing stopUploadWatchersAfter as -1 to let file watchers continue indefinitely if mount is writeable
	stopUploadWatchersAfter := -1

	mainImpl(sess, debug, recurringDownloads, stopRecurringDownloadsAfter, downloadInterval, stopUploadWatchersAfter, concurrency, defaultS3Mounts, destinationBase, region)
}

func mainImpl(sess *session.Session, debug bool, recurringDownloads bool, stopRecurringDownloadsAfter int, downloadInterval int, stopUploadWatchersAfter int, concurrency int, defaultS3Mounts string, destinationBase string, region string) error {
	// Use a map to emulate a set to keep track of existing mounts
	currentMounts := make(map[string]struct{}, 0)
	mountsCh := make(chan *mountConfiguration, 50)

	// Create wait group to keep track of go routines being spawned
	// so the main go routine can wait for them to completes
	var wg sync.WaitGroup

	// In another thread, get the next mount configuration from the buffered channel
	// and download the files. If the share is marked as writeable then start the
	// file watchers in another thread (because the setup function won't return)
	go func() {
		for {
			mountConfig := <-mountsCh
			if debug {
				log.Printf("Received mount configuration from channel: %+v\n", mountConfig)
			}
			var sessionToUse *session.Session = sess
			var studyId string = filepath.Base(mountConfig.destination)
			if !(strings.TrimSpace(mountConfig.roleArn) == "") {
				sessionToUse = makeSession(studyId, region)
			}
			bucket := mountConfig.bucket
			awsRegion, err := s3manager.GetBucketRegion(context.Background(), sessionToUse, bucket, *sess.Config.Region)
			if debug {
				log.Println("Bucket", bucket, "region is", awsRegion)
			}
			if err != nil {
				log.Println("Error getting region of the bucket", bucket, err)
			} else {
				sessionToUse = session.Must(session.NewSession(sessionToUse.Config))
				sessionToUse.Config.WithRegion(awsRegion)
			}
			if recurringDownloads {
				// Trigger recurring download
				setupRecurringDownloads(&wg, sessionToUse, mountConfig, concurrency, debug, downloadInterval, stopRecurringDownloadsAfter)
			} else {
				downloadFiles(sessionToUse, mountConfig, concurrency, debug)
			}
			if mountConfig.writeable {
				go func() {
					err := setupUploadWatcher(&wg, sessionToUse, mountConfig, stopUploadWatchersAfter, debug)
					if err != nil {
						log.Printf("Error setting up file watcher: " + err.Error())
					}
				}()
			}
			if debug {
				log.Printf("Decrement wg counter")
			}
			wg.Done() // Decrement wait group counter everytime we receive config from the mount channel and complete processing it
		}
	}()

	if debug {
		log.Println("Fetching environment info")
	}

	var s3MountsPtr *[]s3Mount
	var err error
	if defaultS3Mounts != "" {
		s3MountsPtr, err = getDefaultMounts(defaultS3Mounts)
	}

	if err != nil {
		log.Print("Error getting environment info: " + err.Error())
		return err
	}

	var s3Mounts []s3Mount
	if s3MountsPtr != nil {
		s3Mounts = *s3MountsPtr
	}

	if debug {
		log.Println("Parsing mounts...")
	}
	for _, mount := range s3Mounts {
		s := mountToString(&mount)
		_, exists := currentMounts[s]

		if debug {
			log.Printf("Mount: %v, Adding to mount queue: %t\n", *mount.Id, !exists)
		}

		if !exists {
			destination := filepath.Join(destinationBase, *mount.Id)
			config := newMountConfiguration(
				*mount.Bucket,
				*mount.Prefix,
				destination,
				*mount.Writeable,
				*mount.KmsArn,
				*mount.RoleArn,
			)
			wg.Add(1) // Increment wait group counter everytime we push config to the mount channel
			if debug {
				log.Printf("Increment wg counter")
			}
			mountsCh <- config
		}

		// Add to the currentMounts
		currentMounts[s] = struct{}{}
	}

	wg.Wait() // Wait until all spawned go routines complete before existing the program

	return nil
}

// Read configuration information fro the program arguments
func readConfigFromArgs() (string, string, string, string, int, bool, int, int, bool, error) {
	defaultS3MountsPtr := flag.String("defaultS3Mounts", "", `A JSON string containing information about the default S3 mounts E.g., [{"id":"some-id","bucket":"some-s3-bucket-name","prefix":"some/s3/prefix/path","writeable":false,"kmsKeyId":"some-kms-key-arn"}]`)
	regionPtr := flag.String("region", "us-east-1", "The aws region to use for the session")
	profilePtr := flag.String("profile", "", "AWS Credentials profile. Default is no profile. The code will look for credentials in the following order: ENV variables, default credentials profile, EC2 instance metadata")
	destinationBasePtr := flag.String("destination", "./", "The directory to download to")
	concurrencyPtr := flag.Int("concurrency", 20, "The number of concurrent parts to download")
	recurringDownloadsPtr := flag.Bool("recurringDownloads", false, "Whether to periodically download changes from S3")
	stopRecurringDownloadsAfterPtr := flag.Int("stopRecurringDownloadsAfter", -1, "Stop recurring downloads after certain number of seconds. ZERO or Negative value means continue indefinitely.")
	downloadIntervalPtr := flag.Int("downloadInterval", 60, "The interval at which to re-download changes from S3 in seconds. This is only applicable when recurringDownloads is true")
	debugPtr := flag.Bool("debug", false, "Whether to print debug information")

	flag.Parse()

	defaultS3Mounts := *defaultS3MountsPtr
	log.Print("defaultS3Mounts: " + defaultS3Mounts)

	region := *regionPtr
	log.Print("region: " + region)

	profile := *profilePtr
	log.Print("profile: " + profile)

	destinationBase := *destinationBasePtr
	log.Print("destinationBase: " + destinationBase)

	concurrency := *concurrencyPtr
	log.Printf("concurrency: %v", concurrency)

	recurringDownloads := *recurringDownloadsPtr
	log.Printf("recurringDownloads: %v", recurringDownloads)

	stopRecurringDownloadsAfter := *stopRecurringDownloadsAfterPtr
	log.Printf("stopRecurringDownloadsAfter: %v", stopRecurringDownloadsAfter)

	downloadInterval := *downloadIntervalPtr
	log.Printf("downloadInterval: %v", downloadInterval)
	if downloadInterval <= 0 {
		return "", "", "", "", 0, false, -1, 0, false, fmt.Errorf("incorrect downloadInterval %v specified; the downloadInterval must be a positive integer", downloadInterval)
	}

	debug := *debugPtr
	log.Printf("debug: %v", debug)

	return defaultS3Mounts, region, profile, destinationBase, concurrency, recurringDownloads, stopRecurringDownloadsAfter, downloadInterval, debug, nil
}

func makeSession(profile string, region string) *session.Session {
	var sess *session.Session
	if profile == "" {
		sess = session.Must(session.NewSessionWithOptions(session.Options{
			Config: aws.Config{Region: aws.String(region)},
		}))
	} else {
		sess = session.Must(session.NewSessionWithOptions(session.Options{
			Config:  aws.Config{Region: aws.String(region)},
			Profile: profile,
		}))
	}

	return sess
}
