// Adapted from https://blog.tocconsulting.fr/download-entire-aws-s3-bucket-using-go/
package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
)

// To hold the number retrieved files
type downloadStats struct {
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
func downloadFiles(sess *session.Session, config *mountConfiguration, debug bool) {
	destination := config.destination
	bucket := config.bucket
	prefix := config.prefix
	start := time.Now()
	if debug == true {
		log.Println("Getting all files from the s3 bucket :", bucket, " and prefix: ", prefix)
		log.Println("And will download them to :", destination)
	}
	stats := getBucketObjects(sess, config, debug)

	end := time.Now()
	duration := end.Sub(start)
	seconds := duration.Seconds()
	if debug == true {
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

func getBucketObjects(sess *session.Session, config *mountConfiguration, debug bool) *downloadStats {
	stats := newDownloadStats()
	bucket := config.bucket
	prefix := config.prefix
	query := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	}
	svc := s3.New(sess)

	truncatedListing := true

	for truncatedListing {
		resp, err := svc.ListObjectsV2(query)

		if err != nil {
			log.Println("Failed to list objects: ", err)
			time.Sleep(time.Duration(30) * time.Second)
			continue
		}
		getObjectsAll(resp, sess, config, stats, debug)

		query.ContinuationToken = resp.NextContinuationToken
		truncatedListing = *resp.IsTruncated
	}

	return stats
}

func getObjectsAll(
	bucketObjectsList *s3.ListObjectsV2Output,
	sess *session.Session,
	config *mountConfiguration,
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

		if debug == true {
			log.Printf("%v -> %v\n", *item.Key, destFilePath)
		}

		// Ensure the directory exists
		os.MkdirAll(filepath.Dir(destFilePath), 0775)

		downloader := s3manager.NewDownloader(sess, func(d *s3manager.Downloader) {
			d.PartSize = 100 * 1024 * 1024
			d.Concurrency = concurrency
		})

		destFile, err := os.Create(destFilePath)
		if err != nil {
			if debug == true {
				log.Println("Create file error: ", err.Error())
			}
			stats.errorPrefixes = append(stats.errorPrefixes, item.Key)
			continue
		}

		numBytes, err := downloader.Download(destFile,
			&s3.GetObjectInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(*item.Key),
			})
		if err != nil {
			if debug == true {
				log.Println("Error downloading file: ", err.Error())
			}
			stats.errorPrefixes = append(stats.errorPrefixes, item.Key)
			continue
		}

		stats.numberOfRetrievedFiles++
		stats.totalRetrievedBytes = stats.totalRetrievedBytes + numBytes
	}
	return stats
}
