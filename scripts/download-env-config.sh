#!/usr/bin/env bash
set -e


cd "$(dirname "${BASH_SOURCE[0]}")/.."


deployment_bucket="${1}"
env_name="${2}"

config_s3_path="s3://${deployment_bucket}/settings/${env_name}.yml"


echo "Downloading config from ${config_s3_path}"
aws s3 cp "${config_s3_path}" "main/config/settings/"
