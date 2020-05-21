#!/bin/bash
set -e

printf "\n\nInitializing env variables required for running integration test against env %s\n" "$@"
# shellcheck disable=SC1091
source ./scripts/get-info.sh "$@"

printf "\n\nExecuting integration tests against env %s\n" "$@"
pnpm run intTest --recursive --if-present