#!/bin/bash
set -e

pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd > /dev/null

# Install
install_dependencies "$@"

function disableStats {
  COMPONENT_DIR=$1
  pushd "$SOLUTION_DIR/../$COMPONENT_DIR" > /dev/null
  # Disable serverless stats (only strictly needs to be done one time)
  $EXEC sls slstats --disable -s "$STAGE"
  popd > /dev/null
}

function componentDeploy {
  COMPONENT_DIR=$1
  COMPONENT_NAME=$2

  pushd "$SOLUTION_DIR/../$COMPONENT_DIR" > /dev/null
  printf "\nDeploying component: %s ...\n\n" "$COMPONENT_NAME"
  $EXEC sls deploy -s "$STAGE"
  printf "\nDeployed component: %s successfully \n\n" "$COMPONENT_NAME"
  popd > /dev/null
}

disableStats "cicd/cicd-pipeline"
componentDeploy "cicd/cicd-pipeline" "CI/CD Pipeline"

printf "\n----- CI/CD PIPELINE DEPLOYED SUCCESSFULLY 🎉 -----\n\n"
