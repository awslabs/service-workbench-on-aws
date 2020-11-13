#!/usr/bin/env bash
set -ue


cd "$(dirname "${BASH_SOURCE[0]}")/.."


deployment_bucket="${1}"
env_name="${2}"

config_s3_path="s3://${deployment_bucket}/settings/${env_name}.yml"
+config_target_path="main/config/settings/${env_name}.yml"


echo "Checking config file ${config_target_path}"
if [ -f "${config_target_path}" ]; then
  echo "Already present; not overwriting!"
else
  echo "Not present; downloading fromm ${config_s3_path}!"
  aws s3 cp "${config_s3_path}" "${config_target_path}"
fi

