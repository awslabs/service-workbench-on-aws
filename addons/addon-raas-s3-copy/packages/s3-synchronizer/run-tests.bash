#!/bin/bash
# exit when any command fails
set -e

mkdir -p ./.build/test
pushd src  > /dev/null

# If GOPATH env variable is empty then initialize it by getting go path from go environment
if [ -z "$GOPATH" ]
then
  GOPATH=$(go env GOPATH)
fi

# If go path is still empty then set it default path of $HOME/go
if [ -z "$GOPATH" ]
then
  GOPATH="$HOME/go"
fi

echo "GOPATH=$GOPATH"
set -o pipefail; go test -v 2>&1 \
  | tee >($GOPATH/bin/go-junit-report -set-exit-code > ../.build/test/report.xml); echo "Tests executed and report exported. Exit Code: $?"

