package main

import (
	"bytes"
	"encoding/json"
	"github.com/mitchellh/go-homedir"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
)

type Marshaller interface {
	marshal(v interface{}) (io.Reader, error)
	unmarshal(r io.Reader, v interface{}) error
}

type JsonMarshaller struct {
}

// Marshal is a function that marshals the object into an
// io.Reader. It uses the JSON format for marshalling/unmarshalling.
func (marshaller JsonMarshaller) marshal(v interface{}) (io.Reader, error) {
	b, err := json.MarshalIndent(v, "", "\t")
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(b), nil
}

// Unmarshal is a function that unmarshalls the data from the
// reader into the specified value. It uses the JSON format for marshalling/unmarshalling.
func (marshaller JsonMarshaller) unmarshal(r io.Reader, v interface{}) error {
	return json.NewDecoder(r).Decode(v)
}

type Persistence interface {
	Save(v interface{}) error
	Load(v interface{}) error
	Clean() error
}
type fileBasedPersistence struct {
	filePath   string
	fileLock   sync.Mutex
	marshaller Marshaller
}

// Returns new Persistence implementation that saves/loads objects from given filePath location
// The given filePath is evaluated to be relative to the given baseDirPath
// If baseDirPath is empty then it creates the given filePath relative to the user's home directory
func NewFileBasedPersistenceWithJsonFormat(filePath string, baseDirPath string) Persistence {
	dirPath := ""
	if baseDirPath == "" {
		// Get user's home directory path
		homeDirPath, err := homedir.Dir()
		if err != nil {
			// Cannot
			log.Fatalf("Cannot get user's home directory path: Error %v\n", err)
		}
		dirPath = homeDirPath
	} else {
		dirPath = baseDirPath
	}

	expandedFilePath := filepath.Join(dirPath, filePath)
	expandedDirPath := filepath.Dir(expandedFilePath)
	// Create directories if needed
	if _, err := os.Stat(expandedDirPath); os.IsNotExist(err) {
		os.MkdirAll(expandedDirPath, os.ModePerm)
	}

	return &fileBasedPersistence{filePath: expandedFilePath, fileLock: sync.Mutex{}, marshaller: JsonMarshaller{}}
}

// Save saves a representation of v to the file at path.
func (persistence fileBasedPersistence) Save(v interface{}) error {
	persistence.fileLock.Lock()
	defer persistence.fileLock.Unlock()
	f, err := os.Create(persistence.filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	r, err := persistence.marshaller.marshal(v)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, r)
	return err
}

// Load loads the file at path into v.
// Use os.IsNotExist() to see if the returned error is due
// to the file being missing.
func (persistence fileBasedPersistence) Load(v interface{}) error {
	persistence.fileLock.Lock()
	defer persistence.fileLock.Unlock()
	f, err := os.Open(persistence.filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	return persistence.marshaller.unmarshal(f, v)
}

func (persistence fileBasedPersistence) Clean() error {
	persistence.fileLock.Lock()
	defer persistence.fileLock.Unlock()
	err := os.Remove(persistence.filePath)
	if err != nil {
		return err
	}
	return err
}
