#!/bin/bash
set -e

# Check that go exists and is executable
if ! [ -x "$(command -v go)" ]; then
  echo "go not found - skipping build"
fi

for GOOS in darwin linux windows; do
# for GOOS in darwin; do
  for GOARCH in amd64; do
    echo "Building $GOOS-$GOARCH"
    export GOOS=$GOOS
    export GOARCH=$GOARCH
      go build -ldflags="-s -w" -o bin/s3-synchronizer-$GOOS-$GOARCH ./src
  done
done
