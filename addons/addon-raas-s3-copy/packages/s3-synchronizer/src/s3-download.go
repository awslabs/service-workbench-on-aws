// Adapted from https://blog.tocconsulting.fr/download-entire-aws-s3-bucket-using-go/
package main

import (
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
)

// Global Variable to hold map of S3 object path vs their ETags
// This map is to avoid unnecessary re-downloads
// If the program is restarted this map will be re-initialized
// and that's fine. This will just cause extra re-downloads but will not break
// anything functionally
var s3FileETagsMap = make(map[string]string)

func recordFileDownloadToLocal(item *s3.Object) {
	s3FileETagsMap[*item.Key] = *item.ETag
}
func recordFileDeletionFromLocal(filePath string, config *mountConfiguration) {
	prefix := config.prefix
	// if prefix ends with trailing slash then remove extra slash
	if strings.HasSuffix(prefix, "/") {
		prefix = strings.TrimSuffix(prefix, "/")
	}

	s3FilePath := strings.TrimPrefix(filePath, config.destination)
	// if s3 file path starts with a trailing slash then remove extra slash
	if strings.HasPrefix(s3FilePath, "/") {
		s3FilePath = strings.TrimPrefix(s3FilePath, "/")
	}

	s3Key := filepath.ToSlash(prefix + "/" + s3FilePath)

	// Delete ETag from cache map when file is deleted from local machine
	delete(s3FileETagsMap, s3Key)
}

func hasFileChangedInS3(item *s3.Object) bool {
	// Return true if the S3 object's ETag is different than the one we have
	// in our cached map
	return s3FileETagsMap[*item.Key] != *item.ETag
}

// To hold the number retrieved files and other download related statistics
type downloadStats struct {
	start                  time.Time
	end                    time.Time
	numberOfRetrievedFiles int
	totalRetrievedBytes    int64
	errorPrefixes          []*string
}

func newDownloadStats() *downloadStats {
	stats := downloadStats{}
	return &stats
}

type mountConfiguration struct {
	bucket      string
	prefix      string
	destination string
	writeable   bool
	kmsKeyId    string
}

func newMountConfiguration(bucket string, prefix string, destination string, writeable bool, kmsKeyId string) *mountConfiguration {
	config := mountConfiguration{
		bucket:      bucket,
		prefix:      prefix,
		destination: destination,
		writeable:   writeable,
		kmsKeyId:    kmsKeyId,
	}
	return &config
}

// Downloads the files based on the given mount configuration from S3 using
// s3Manager https://docs.aws.amazon.com/sdk-for-go/api/service/s3/s3manager/#NewDownloader.
// It downloads each file as multipart download (i.e., downloads in chunks).
func downloadFiles(sess *session.Session, config *mountConfiguration, concurrency int, debug bool) {
	destination := config.destination
	bucket := config.bucket
	prefix := config.prefix

	if debug {
		log.Println("Getting all files from the s3 bucket :", bucket, " and prefix: ", prefix)
		log.Println("And will download them to :", destination)
	}

	stats := syncS3ToLocal(sess, config, concurrency, debug)
	reportDownloadStats(stats, debug)
}

func reportDownloadStats(stats *downloadStats, debug bool) {
	end := time.Now()
	duration := end.Sub(stats.start)
	seconds := duration.Seconds()
	if debug {
		log.Printf("Downloaded %d files - %d bytes total at %.1f MB/s\n",
			stats.numberOfRetrievedFiles, stats.totalRetrievedBytes, float64(stats.totalRetrievedBytes)/float64(1e6)/seconds)
		if len(stats.errorPrefixes) > 0 {
			log.Println("The following objects had errors:")
			for _, p := range stats.errorPrefixes {
				log.Println("- ", *p)
			}
		}
	}
}

func syncS3ToLocal(sess *session.Session, config *mountConfiguration, concurrency int, debug bool) *downloadStats {

	stats := newDownloadStats()
	stats.start = time.Now()

	bucket := config.bucket
	prefix := config.prefix
	query := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	}
	svc := s3.New(sess)

	truncatedListing := true

	// accumulate responses of s3.ListObjectsV2 calls through all pages in case s3.ListObjectsV2 is paginated
	// the accumulated listObjectResponses will then be used to find file on local filesystem that are not there in S3
	var listObjectResponses []*s3.ListObjectsV2Output

	for truncatedListing {
		resp, err := svc.ListObjectsV2(query)

		if err != nil {
			log.Println("Failed to list objects: ", err)
			// 30 seconds backoff
			time.Sleep(time.Duration(30) * time.Second)
			continue
		}

		listObjectResponses = append(listObjectResponses, resp)
		downloadAllObjects(resp, sess, config, concurrency, stats, debug)

		query.ContinuationToken = resp.NextContinuationToken
		truncatedListing = *resp.IsTruncated
	}

	err := deleteLocalFilesNotInS3(listObjectResponses, config, debug)
	if err != nil {
		fmt.Println("Error: ", err)
	}

	stats.end = time.Now()
	return stats
}

func deleteLocalFilesNotInS3(listObjectResponses []*s3.ListObjectsV2Output, config *mountConfiguration, debug bool) error {
	destination := config.destination
	prefix := config.prefix

	findInS3 := func(path string) *s3.Object {
		for _, listObjectResponse := range listObjectResponses {
			for _, item := range listObjectResponse.Contents {
				// Strip the base s3 prefix
				destFilename := strings.TrimPrefix(*item.Key, prefix)
				destFilePath := filepath.Join(destination, destFilename)
				if path == destFilePath {
					return item
				}
			}
		}
		return nil
	}

	walkerFn := func(path string, info os.FileInfo, err error) error {
		// Don't do anything if there was any error during walking the file tree
		if err != nil {
			fmt.Printf("\nError walking the file tree: \"%s\". Error: %v\n", path, err)
			return nil
		}
		if info.Mode().IsDir() {
			// Ignore directories
			return nil
		}

		fileInS3 := findInS3(path)
		if fileInS3 == nil {
			// file NOT in S3 but is in local file system -- DELETE from local file system
			if debug {
				fmt.Printf("\n\nFile '%s' removed from S3 so deleting it from local file system\n\n", path)
			}
			error := os.Remove(path)
			if error == nil {
				recordFileDeletionFromLocal(path, config)
			} else {
				fmt.Printf("\nError deleting file: \"%s\". Error: %v\n", path, error)
			}
		}
		return nil
	}

	err := filepath.Walk(destination, walkerFn)
	return err
}

func setupRecurringDownloads(wg *sync.WaitGroup, sess *session.Session, config *mountConfiguration, concurrency int, debug bool, downloadInterval int, stopRecurringDownloadsAfter int) {
	// Increment wait group counter everytime we spawn recurring downloads thread to make sure
	// the caller (main) can wait
	wg.Add(1)

	statsCh := make(chan *downloadStats, 50)

	continueRecurringDownloads := true
	setupStartTime := time.Now()

	// Kick off thread for recurring download for this mount configuration
	// This thread will push download stats to stats channel and the reporter thread will receive stats from the
	// stats channel and report (print) the stats
	go func() {
		for continueRecurringDownloads {
			stats := syncS3ToLocal(sess, config, concurrency, debug)

			statsCh <- stats // Push download stats to the stats channel. The reporter will read from statsCh and report it

			// stopRecurringDownloadsAfter is negative then continue recurring downloads indefinitely
			if stopRecurringDownloadsAfter > 0 {
				current := time.Now()
				duration := current.Sub(setupStartTime)
				seconds := int(math.Round(duration.Seconds()))
				// If the duration to continue recurring downloads has passed then set
				// continueRecurringDownloads flag to false to stop the recurring downloads
				// from happening further
				if seconds > stopRecurringDownloadsAfter {
					continueRecurringDownloads = false

					// Decrement from the wait group indicating we are done
					wg.Done()
				}
			}
			// Sleep for the download interval duration
			time.Sleep(time.Duration(downloadInterval) * time.Second)
		}
	}()

	// Kick off reporter thread for recurring reporting of the download stats
	go func() {
		for continueRecurringDownloads {
			stats := <-statsCh

			reportDownloadStats(stats, debug)
		}
	}()
}

func downloadAllObjects(
	bucketObjectsList *s3.ListObjectsV2Output,
	sess *session.Session,
	config *mountConfiguration,
	concurrency int,
	stats *downloadStats,
	debug bool,
) *downloadStats {
	bucket := config.bucket
	destination := config.destination
	prefix := config.prefix

	for _, item := range bucketObjectsList.Contents {
		// Strip the s3 prefix
		destFilename := strings.TrimPrefix(*item.Key, prefix)
		destFilePath := filepath.Join(destination, destFilename)
		// Skip objects ending in / - we can't store these on the file system
		if strings.HasSuffix(*item.Key, "/") {
			continue
		}

		// Ensure the directory exists
		os.MkdirAll(filepath.Dir(destFilePath), 0775)

		shouldDownload := true

		// Note that we cannot use os.IsExist(fileError) to check for file's existence
		// os.IsExist and os.IsNotExist are error checker functions and only work when error is not nil
		// The correct way to check if file exists is using !os.IsNotExist(fileError)
		if _, fileError := os.Stat(destFilePath); !os.IsNotExist(fileError) {
			// If the file has not changed in S3 since last download then skip downloading it
			shouldDownload = hasFileChangedInS3(item)
			if !shouldDownload && debug {
				log.Printf("'%v' already exists and is up-to-date. Skip downloading '%v'\n", destFilePath, *item.Key)
			}
		}
		if !shouldDownload {
			continue
		}

		if debug {
			log.Printf("%v -> %v\n", *item.Key, destFilePath)
		}

		destFile, err := os.Create(destFilePath)
		if err != nil {
			if debug {
				log.Println("Create file error: ", err.Error())
			}
			stats.errorPrefixes = append(stats.errorPrefixes, item.Key)
			continue
		}

		downloader := s3manager.NewDownloader(sess, func(d *s3manager.Downloader) {
			d.PartSize = 100 * 1024 * 1024
			d.Concurrency = concurrency
		})
		numBytes, err := downloader.Download(destFile,
			&s3.GetObjectInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(*item.Key),
			})
		if err != nil {
			if debug {
				log.Println("Error downloading file: ", err.Error())
			}
			stats.errorPrefixes = append(stats.errorPrefixes, item.Key)
			continue
		}

		stats.numberOfRetrievedFiles++
		stats.totalRetrievedBytes = stats.totalRetrievedBytes + numBytes

		recordFileDownloadToLocal(item)
	}
	return stats
}
