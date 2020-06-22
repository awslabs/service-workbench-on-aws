#!/bin/bash
set -e
set -o pipefail

pushd "$(dirname ${BASH_SOURCE[0]})"
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd

# Ensure settings file exists
ensure_setttings_file "$@"

# Setup the execution command
init_package_manager

##
#  Displays human friendly summary message containing information required to configure Relying Party Trust in ADFS
##
function get_rp_info() {
  local solution_name="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'solutionName:' --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
  local aws_region="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'awsRegion:' --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
  local userpool_name="${STAGE}-${solution_name}-userPool"
  local aws_profile="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep -w 'awsProfile:' --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
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
