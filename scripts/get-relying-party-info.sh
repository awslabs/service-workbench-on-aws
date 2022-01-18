#!/bin/bash
set -e
set -o pipefail

pushd "$(dirname ${BASH_SOURCE[0]})" &> /dev/null
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd &> /dev/null

# Setup the execution command
init_package_manager

# Return value of given key from config file
# Display error message and exit non-zero unless key-value is uncommented and value is non-zero in length
function get_config_value() {
  local config_value=$(grep -i "^\s*${1}" $2 | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
  if [ -z "${config_value}" ]; then
    echo "ERROR: Required value '${1}' is missing, commented out, or undefined in configuration file" 1>&2
    exit 1
  fi
  echo "Read configuration value: ${1} = ${config_value}" 1>&2
  echo $config_value
}

##
#  Displays human friendly summary message containing information required to configure Relying Party Trust in ADFS
##
function get_rp_info() {
  local config_file=$CONFIG_DIR/settings/$STAGE.yml
  if [ ! -f $config_file ]; then
    echo "ERROR: Configuration file does not exist: ${config_file}" 1>&2
    exit 1
  else
    echo "Using configuration file: ${config_file}"
  fi

  local aws_profile=$(get_config_value 'awsProfile' $config_file)
  local aws_region=$(get_config_value 'awsRegion' $config_file)
  local solution_name=$(get_config_value 'solutionName' $config_file)

  # Exit if any of these config values were not set
  for var in solution_name aws_region aws_profile; do
    if [ ! ${!var} ]; then
      echo "Configuration value ${var} not defined: Exiting" 1>&2
      exit
    fi
  done

  local userpool_name="${STAGE}-${solution_name}-userPool"
  local aws_profile_cli_param=""
  if [ $aws_profile ]; then
    aws_profile_cli_param="--profile $aws_profile"
  fi

  userpool_id=$(aws cognito-idp list-user-pools \
    $aws_profile_cli_param \
    --region $aws_region \
    --max-results 60 \
    --output text --query "UserPools[?Name=='${userpool_name}'].Id")

  userpool_signing_cert=$(aws cognito-idp get-signing-certificate \
    $aws_profile_cli_param \
    --user-pool-id  ${userpool_id} \
    --output text)

  domain_name_prefix=$(aws cognito-idp describe-user-pool \
    $aws_profile_cli_param \
    --user-pool-id ${userpool_id} \
    --output text --query "UserPool.Domain")

  printf "\n\n\n-------------------------------------------------------------------------\n"
  echo "Summary:"
  echo "-------------------------------------------------------------------------"
  printf "\n\n"
  echo "User Pool Id                                      : ${userpool_id}"
  echo "Relying Party Id (Cognito User Pool URN)          : urn:amazon:cognito:sp:${userpool_id}"
  echo "(Login) SAML Assersion Consumer Endpoint          : https://${domain_name_prefix}.auth.${aws_region}.amazoncognito.com/saml2/idpresponse"
  echo "(Logout) SAML Logout Endpoint                     : https://${domain_name_prefix}.auth.${aws_region}.amazoncognito.com/saml2/logout"
  echo "User Pool Signing Cert                            : ${userpool_signing_cert}"
  echo "Solution                                          : ${solution_name}"
  echo "Environment Name                                  : ${STAGE}"
  printf "\n\n-------------------------------------------------------------------------\n\n"
}

get_rp_info
