package main

import (
	"encoding/json"
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/johannesboyne/gofakes3"
	"github.com/johannesboyne/gofakes3/backend/s3mem"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

var testAwsSession *session.Session

const testRegion = "us-east-1"

// A test destination directory path. The test creates this directory and populates it with simulated downloads
// This directory is cleaned up at the end of the test.
// WARNING: Since this directory gets automatically cleaned up at the end of the test,
// make sure to not specify some higher path here as the test program will end up deleting the directory
// you specify here.
const destinationBase = "../.build/temp-output"

const testFakeBucketName = "test-bucket"

// ------------------------------- Test Cases -------------------------------/

// Test for single S3Mount
func TestMainImplForInitialDownloadSingleMount(t *testing.T) {
	// ---- Data setup ----
	noOfMounts := 1
	testMounts := make([]s3Mount, noOfMounts)
	testMountId := "test-mount"
	noOfFilesInMount := 5
	testMounts[0] = *putTestMountFiles(t, testFakeBucketName, testMountId, noOfFilesInMount)
	testMountsJsonBytes, err := json.Marshal(testMounts)
	testMountsJson := string(testMountsJsonBytes)

	if err != nil {
		// Fail test in case of any errors
		t.Logf("Error creating test mount setup data %s", err)
	}

	// ---- Inputs ----
	debug := true
	concurrency := 2

	fmt.Printf("Input: \n\n%s\n\n", testMountsJson)

	// ---- Run code under test ----
	err = mainImpl(testAwsSession, debug, concurrency, testMountsJson, destinationBase)
	if err != nil {
		// Fail test in case of any errors
		t.Logf("Error running the main s3-synchronizer with testMountsJson %s", testMountsJson)
		t.Errorf("Error: %v", err)
	}

	// ---- Assertions ----
	assertFilesDownloaded(t, testMountId, noOfFilesInMount)
}

// Test for multiple S3Mounts
func TestMainImplForInitialDownloadMultipleMounts(t *testing.T) {
	// ---- Data setup ----
	noOfMounts := 3
	testMounts := make([]s3Mount, noOfMounts)
	testBucketName := "test-bucket"

	testMountId1 := "test-mount1"
	noOfFilesInMount1 := 5
	testMounts[0] = *putTestMountFiles(t, testBucketName, testMountId1, noOfFilesInMount1)

	testMountId2 := "test-mount2"
	noOfFilesInMount2 := 1
	testMounts[1] = *putTestMountFiles(t, testBucketName, testMountId2, noOfFilesInMount2)

	testMountId3 := "test-mount3"
	noOfFilesInMount3 := 0 // Test mount containing no files (simulating empty folder in S3)
	testMounts[2] = *putTestMountFiles(t, testBucketName, testMountId3, noOfFilesInMount3)

	testMountsJsonBytes, err := json.Marshal(testMounts)
	testMountsJson := string(testMountsJsonBytes)

	if err != nil {
		// Fail test in case of any errors
		t.Logf("Error creating test mount setup data %s", err)
	}

	// ---- Inputs ----
	debug := true
	concurrency := 2

	fmt.Printf("Input: \n\n%s\n\n", testMountsJson)

	// ---- Run code under test ----
	err = mainImpl(testAwsSession, debug, concurrency, testMountsJson, destinationBase)
	if err != nil {
		// Fail test in case of any errors
		t.Logf("Error running the main s3-synchronizer with testMountsJson %s", testMountsJson)
		t.Errorf("Error: %v", err)
	}

	// ---- Assertions ----
	assertFilesDownloaded(t, testMountId1, noOfFilesInMount1)
	assertFilesDownloaded(t, testMountId2, noOfFilesInMount2)
	assertFilesDownloaded(t, testMountId3, noOfFilesInMount3)
}

// Test for invalid s3Mounts json being empty array
func TestMainImplForInitialDownloadEmptyMounts(t *testing.T) {
	// ---- Data setup ----
	var testMounts []s3Mount

	testMountsJsonBytes, err := json.Marshal(testMounts)
	testMountsJson := string(testMountsJsonBytes)

	if err != nil {
		// Fail test in case of any errors
		t.Logf("Error creating test mount setup data %s", err)
	}

	// ---- Inputs ----
	debug := true
	concurrency := 2

	fmt.Printf("Input: \n\n%s\n\n", testMountsJson)

	// ---- Run code under test ----
	err = mainImpl(testAwsSession, debug, concurrency, testMountsJson, destinationBase)
	if err != nil {
		// Fail test in case of any errors
		t.Logf("Error running the main s3-synchronizer with testMountsJson %s", testMountsJson)
		t.Errorf("Error: %v", err)
	}
}

// Negative test: Test for invalid s3Mounts json
func TestMainImplForInitialDownloadInvalidMounts(t *testing.T) {
	// ---- Inputs ----
	debug := true
	concurrency := 2

	testMountsJson := "some invalid json"
	fmt.Printf("Input: \n\n%s\n\n", testMountsJson)

	// ---- Run code under test ----
	err := mainImpl(testAwsSession, debug, concurrency, testMountsJson, destinationBase)
	if err == nil {
		// Fail test in case of no errors since we are expecting errors when passing invalid json for mounting
		t.Logf("Expecting error when running the main s3-synchronizer with invalid testMountsJson but it ran fine")
	}
}

// ------------------------------- Setup code -------------------------------/

// The main testing function that calls setup and shutdown and runs each test defined in this test file
func TestMain(m *testing.M) {
	fakeS3Server := setup()
	code := m.Run()
	shutdown(fakeS3Server)
	os.Exit(code)
}

func putTestMountFiles(t *testing.T, bucketName string, testMountId string, noOfFiles int) *s3Mount {
	s3Client := s3.New(testAwsSession)

	mountPrefix := fmt.Sprintf("studies/Organization/%s", testMountId)
	for i := 0; i < noOfFiles; i++ {
		_, err := s3Client.PutObject(&s3.PutObjectInput{
			Body:   strings.NewReader("test file content"),
			Bucket: aws.String(bucketName),
			Key:    aws.String(fmt.Sprintf("%s/test%d.txt", mountPrefix, i)),
		})
		if err != nil {
			// Fail test in case of any errors
			t.Errorf("Could not put test files to fake S3 server for testing: %v", err)
		}
	}

	writeable := false
	kmsKeyId := ""
	return &s3Mount{Id: &testMountId, Bucket: &bucketName, Prefix: &mountPrefix, Writeable: &writeable, KmsKeyId: &kmsKeyId}
}

func assertFilesDownloaded(t *testing.T, testMountId string, noOfFiles int) {
	for i := 0; i < noOfFiles; i++ {
		expectedFile := fmt.Sprintf("%s/%s/test%d.txt", destinationBase, testMountId, i)
		if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
			t.Errorf(`Expected: File "%v" to exist after download | Actual: The file not found`, expectedFile)
		}
	}
}

func setup() *httptest.Server {
	// fake s3
	backend := s3mem.New()
	faker := gofakes3.New(backend)
	fakeS3Server := httptest.NewServer(faker.Server())
	testAwsSession = makeTestSession(fakeS3Server)

	createFakeS3BucketForTesting()

	return fakeS3Server
}

func createFakeS3BucketForTesting() {
	s3Client := s3.New(testAwsSession)
	params := &s3.CreateBucketInput{
		Bucket: aws.String(testFakeBucketName),
	}
	_, err := s3Client.CreateBucket(params)
	if err != nil {
		// Fail test in case of any errors
		fmt.Printf("\n\nCould not create bucket using fake S3 server for testing: %v\n\n", err)

		// Exit program with non-zero exit code
		// Cannot use "t.Errorf" to fail here since this is executed from setup
		os.Exit(1)
	}
}

func shutdown(fakeS3Server *httptest.Server) {
	fakeS3Server.Close()

	// delete all temporary output files created under destinationBase
	err := os.RemoveAll(destinationBase)
	if err != nil {
		fmt.Printf("\n\nError cleaning up the temporary output directory '%s': %v\n\n", destinationBase, err)

		// Exit program with non-zero exit code
		// Cannot use "t.Errorf" to fail here since this is executed from shutdown
		os.Exit(1)
	}
}

func makeTestSession(fakeS3Server *httptest.Server) *session.Session {
	var sess *session.Session
	s3Config := &aws.Config{
		Credentials:      credentials.NewStaticCredentials("FAKE-ACCESSKEYID", "FAKE-SECRETACCESSKEY", ""),
		Endpoint:         aws.String(fakeS3Server.URL),
		Region:           aws.String(testRegion),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
	}
	s3Config.WithS3ForcePathStyle(true)

	sess = session.Must(session.NewSessionWithOptions(session.Options{
		Config: *s3Config,
	}))
	return sess
}
