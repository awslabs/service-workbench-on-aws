#!/usr/bin/env bash
set -e

echo "Downloading test config"

pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
# shellcheck disable=SC1091
[[ ${UTIL_SOURCED-no} != yes && -f ./util.sh ]] && source ./util.sh
popd > /dev/null

ENV_NAME=$@
CONFIG_S3_PATH="s3://$DEPLOYMENT_BUCKET/integration-test/$ENV_NAME.yml"
CONFIG_TARGET_PATH="$INT_TEST_DIR/config/settings/$ENV_NAME.yml"

echo "Checking config file ${CONFIG_TARGET_PATH}"
if [ -e "${CONFIG_TARGET_PATH}" ]; then
  echo "Already present; not overwriting!"
else
  echo "Not present; checking if present in S3"
  aws s3api head-object --bucket $DEPLOYMENT_BUCKET --key "integration-test/$ENV_NAME.yml" || TEST_CONFIG_EXISTS=false

  if [ "$TEST_CONFIG_EXISTS" == true ]; then
    echo "Test config found! Downloading from ${CONFIG_S3_PATH}"
    aws s3 cp "${CONFIG_S3_PATH}" "${CONFIG_TARGET_PATH}"
  else
    echo "Test config file does not exist. Integration tests will be skipped!"
  fi
fi

if [ "$TEST_CONFIG_EXISTS" == true ]; then
    # shellcheck disable=SC1091

    printf "\n\nExecuting integration tests against env %s\n" "$ENV_NAME"
    pnpm run intTest --recursive --if-present -- --stage="$ENV_NAME"
else
    # Create empty report file
    mkdir -p main/integration-tests/.build/test
    echo '<?xml version="1.0" encoding="UTF-8"?>
    <testsuites name="Integration tests were skipped!" tests="0" failures="0" time="0"><testsuite></testsuite></testsuites>' > "main/integration-tests/.build/test/junit.xml"
fi