#!/bin/sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd $SCRIPT_DIR
./build-all-packages.sh
cd ./../main/solution/ui
pnpx sls package-ui --stage $1 --local=true
pnpx sls package-ui --stage $1
pnpx sls deploy-ui --stage $1 --invalidate-cache=true
cd -
