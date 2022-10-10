#!/bin/bash
set -e
set -o pipefail

pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd > /dev/null

# Install
install_dependencies "$@"

function disableStats {
  COMPONENT_DIR=$1
  pushd "$SOLUTION_DIR/$COMPONENT_DIR" > /dev/null
    # Disable serverless stats globally (only strictly needs to be done one time)
    # For more information: https://www.serverless.com/framework/docs/providers/aws/cli-reference/slstats#disable-statistics-and-usage-tracking
    $EXEC sls slstats --disable
  popd > /dev/null
}

function componentDeploy {
  COMPONENT_DIR=$1
  COMPONENT_NAME=$2

  pushd "$SOLUTION_DIR/$COMPONENT_DIR" > /dev/null
  printf "\nDeploying component: %s ...\n\n" "$COMPONENT_NAME"
  $EXEC sls deploy -s "$STAGE"
  printf "\nDeployed component: %s successfully \n\n" "$COMPONENT_NAME"
  stack_name=$($EXEC sls info -s "$STAGE" | grep 'stack:' --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
  set +e
  solution_name="$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" 2> /dev/null | grep '^solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
  aws_region="$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" 2> /dev/null | grep '^awsRegion:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
  aws_profile="$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" 2> /dev/null | grep '^awsProfile:' -m 1 | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
  set -e
  if [ "$aws_profile" ]; then
    # shellcheck disable=SC2016
    master_role_arn="$(aws cloudformation describe-stacks --stack-name "$stack_name" --output text --region "$aws_region" --profile "$aws_profile" --query 'Stacks[0].Outputs[?OutputKey==`MasterRoleArn`].OutputValue')"
  else
    # shellcheck disable=SC2016
    master_role_arn="$(aws cloudformation describe-stacks --stack-name "$stack_name" --output text --region "$aws_region" --query 'Stacks[0].Outputs[?OutputKey==`MasterRoleArn`].OutputValue')"
  fi
  echo "-------------------------------------------------------------------------"
  echo "Summary:"
  echo "-------------------------------------------------------------------------"
  echo "Master Role ARN: ${master_role_arn}"
  popd > /dev/null
}

disableStats "prepare-master-acc"
componentDeploy "prepare-master-acc" "Master Account"

printf "\n----- MASTER ACCOUNT CONFIGURATION DEPLOYED SUCCESSFULLY 🎉 -----\n\n"
