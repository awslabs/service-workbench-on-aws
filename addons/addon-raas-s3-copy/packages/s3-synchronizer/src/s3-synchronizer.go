package main

import (
	"flag"
	"github.com/aws/aws-sdk-go/aws"
	"log"
	"path/filepath"
	"sync"

	"github.com/aws/aws-sdk-go/aws/session"
)

func main() {
	defaultS3Mounts, region, profile, destinationBase, concurrency, debug := readConfigFromArgs()
	sess := makeSession(profile, region)

	mainImpl(sess, debug, concurrency, defaultS3Mounts, destinationBase)
}

func mainImpl(sess *session.Session, debug bool, concurrency int, defaultS3Mounts string, destinationBase string) error {
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
			if debug == true {
				log.Printf("Received mount configuration from channel: %+v\n", mountConfig)
			}
			downloadFiles(sess, mountConfig, concurrency, debug)
			if mountConfig.writeable {
				log.Print("WARNING: writeable mounts are no implemented yet")
			}
			if debug == true {
				log.Printf("Decrement wg counter")
			}
			wg.Done() // Decrement wait group counter everytime we receive config from the mount channel and complete processing it
		}
	}()

	if debug == true {
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

	if debug == true {
		log.Println("Parsing mounts...")
	}
	for _, mount := range s3Mounts {
		s := mountToString(&mount)
		_, exists := currentMounts[s]

		if debug == true {
			log.Printf("Mount: %v, Adding to mount queue: %t\n", *mount.Id, !exists)
		}

		if !exists {
			destination := filepath.Join(destinationBase, *mount.Id)
			config := newMountConfiguration(
				*mount.Bucket,
				*mount.Prefix,
				destination,
				*mount.Writeable,
				*mount.KmsKeyId,
			)
			wg.Add(1) // Increment wait group counter everytime we push config to the mount channel
			if debug == true {
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
func readConfigFromArgs() (string, string, string, string, int, bool) {
	defaultS3MountsPtr := flag.String("defaultS3Mounts", "", `A JSON string containing information about the default S3 mounts E.g., [{"id":"some-id","bucket":"some-s3-bucket-name","prefix":"some/s3/prefix/path","writeable":false,"kmsKeyId":"some-kms-key-arn"}]`)
	regionPtr := flag.String("region", "us-east-1", "The aws region to use for the session")
	profilePtr := flag.String("profile", "", "AWS Credentials profile. Default is no profile. The code will look for credentials in the following order: ENV variables, default credentials profile, EC2 instance metadata")
	destinationBasePtr := flag.String("destination", "./", "The directory to download to")
	concurrencyPtr := flag.Int("concurrency", 20, "The number of concurrent parts to download")
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

	debug := *debugPtr
	log.Printf("debug: %v", debug)

	//pollInterval := *pollIntervalPtr

	return defaultS3Mounts, region, profile, destinationBase, concurrency, debug
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
