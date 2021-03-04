#!/usr/bin/env bash
set -eu


cd "$(dirname "${BASH_SOURCE[0]}")/.."


aws_profile="${1}"
deployment_bucket="${2}"
shift 2

config_s3_path="s3://${deployment_bucket}/integration-test/"

for environment_name in "$@"; do
  config_filename="../../integration-tests/config/settings/${environment_name}.yml"

  if [[ -f "${config_filename}" ]]; then
    git ls-files --error-unmatch "${config_filename}" >/dev/null 2>&1 && (
      echo "File '${config_filename}' is tracked in version control; not uploaded to S3"
    ) || (
      echo "File '${config_filename}' is not tracked in version control"
      # no need to echo an acknowledgement of upload, as the aws command does that anyway
      aws --profile "${aws_profile}" s3 cp --sse aws:kms "${config_filename}" "${config_s3_path}"
    )
  else
    echo "File not found: '${config_filename}'; ignored!"
  fi
done
