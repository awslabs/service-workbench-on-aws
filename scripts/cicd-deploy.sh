#!/bin/bash
set -e

printf "\n\n\n ****** DEPLOY SERVICE-WORKBENCH-ON-AWS [$STAGE] ******"
printf "\nYou are about to deploy a version of Service-Workbench-On-Aws on your AWS account. Stage name is [$STAGE]"
printf "\nDo you want to proceed to the deployment ? (y/n): "
read -r confirmation
if [ "$confirmation" != "y" ]; then
    printf "\n\nDeployment canceled. Exiting.\n\n"
    exit 1
fi

pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd > /dev/null

# Install dependencies
printf "\n\n---- Install dependencies\n"
install_dependencies "$@"

pushd "$SOLUTION_ROOT_DIR/main/cicd/cicd-pipeline" > /dev/null

# Disable serverless stats globally (only strictly needs to be done one time)
# For more information: https://www.serverless.com/framework/docs/providers/aws/cli-reference/slstats#disable-statistics-and-usage-tracking
$EXEC sls slstats --disable

# Deploy the updated stack of the CICD
printf "\n\n---- Deploy CICD Stack\n"
$EXEC sls deploy -s "$STAGE"

# Update the Github token if necessary
printf "\n\n--- Check Github Token used by the CICD pipeline"
printf "\nThe CICD requires a valid Github Access Token to be able to pull the latest updates its associated code repository.\n"

pipeline_stack_name=$($EXEC sls info -s $STAGE | grep 'stack:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
aws_region="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'awsRegion:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
solution_name="$(cat $CONFIG_DIR/settings/$STAGE.yml $CONFIG_DIR/settings/.defaults.yml | grep 'solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
token_name="/$STAGE/$solution_name/github/token"

source ./scripts/deploy-github-token.bash $pipeline_stack_name $token_name $aws_region
popd > /dev/null

printf "\n\n\n------------------------------------------------------------------------------------------"
printf "\n-----------               CI/CD PIPELINE DEPLOYED SUCCESSFULLY 🎉              -----------"
printf "\n-----------  https://console.aws.amazon.com/codesuite/codepipeline/pipelines/  -----------"
printf "\n------------------------------------------------------------------------------------------\n\n\n"
