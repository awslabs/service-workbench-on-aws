#!/bin/bash
set -e

cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh

# Install
install_dependencies "$@"

# Delete
printf "\nWARNING: THIS COMMAND WILL DELETE YOUR CI/CD PIPELINE AND LEAD TO DATA LOSS.\n"
printf "\nAre you sure you want to proceed? Press ENTER to ABORT OR Type the environment name to confirm removal (%s): " "$STAGE"
read -r confirmation

if [[ "$STAGE" != "$confirmation" ]]
then
    printf "\nConfirmation mismatch. Exiting ...\n"
    exit
fi

function componentRemove {
    COMPONENT_DIR=$1
    COMPONENT_NAME=$2

    printf "\Removing component: %s ...\n\n" "$COMPONENT_NAME"
    cd "$SOLUTION_DIR/$COMPONENT_DIR"
    $EXEC serverless remove -s "$STAGE"
}

componentRemove "cicd/cicd-pipeline" "CI/CD Pipeline"

printf "\n----- CI/CD PIPELINE DELETED SUCCESSFULLY 🎉 -----\n\n\n"
