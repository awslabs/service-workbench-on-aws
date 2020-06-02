#!/usr/bin/env bash
set -e


cd "$(dirname "${BASH_SOURCE[0]}")/.."


deployment_bucket="${1}"
environment_name="${2}"

config_filename="../../config/settings/${environment_name}.yml"
config_s3_path="s3://${deployment_bucket}/settings/"


if [[ -f "${config_filename}" ]]; then
  echo "Uploading ${config_filename} to ${config_s3_path}"
  aws s3 cp --sse aws:kms "${config_filename}" "${config_s3_path}"
fi
