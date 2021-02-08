#!/usr/bin/env bash
set -ue

pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
# shellcheck disable=SC1091
[[ ${UTIL_SOURCED-no} != yes && -f ./util.sh ]] && source ./util.sh
popd > /dev/null

DEPLOYMENT_BUCKET="${1}"
ENV_NAME="${2}"

CONFIG_S3_PATH="s3://${DEPLOYMENT_BUCKET}/integration-test/${ENV_NAME}.yml"
CONFIG_TARGET_PATH="$INT_TEST_DIR/config/settings/${ENV_NAME}.yml"

echo "Checking config file ${CONFIG_TARGET_PATH}"
if [ -e "${CONFIG_TARGET_PATH}" ]; then
  echo "Already present; not overwriting!"
else
  echo "Not present; checking if present in S3"
  aws s3api head-object --bucket ${DEPLOYMENT_BUCKET} --key "integration-test/${ENV_NAME}.yml" || TEST_CONFIG_EXISTS=false

  if [ !$TEST_CONFIG_EXISTS ]; then
  echo "Test config file does not exist. Integration tests will be skipped!"
  else
    echo "Test config found! Downloading from ${CONFIG_S3_PATH}"
    aws s3 cp "${CONFIG_S3_PATH}" "${CONFIG_TARGET_PATH}"
  fi
fi
