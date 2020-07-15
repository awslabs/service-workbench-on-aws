#!/usr/bin/env bash
set -e


cd "$(dirname "${BASH_SOURCE[0]}")/.."


aws_profile="${1}"
deployment_bucket="${2}"
environment_name="${3}"

config_filename="../../config/settings/${environment_name}.yml"
config_s3_path="s3://${deployment_bucket}/settings/"


if [[ -f "${config_filename}" ]]; then
  echo "Uploading ${config_filename} to ${config_s3_path}"
  aws --profile "${aws_profile}" s3 cp --sse aws:kms "${config_filename}" "${config_s3_path}"
fi