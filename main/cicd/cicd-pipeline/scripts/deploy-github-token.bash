#!/usr/bin/env bash
set -e

# This script helps users to set up the integration of the CICD-Pipeline with GitHub 
# by setting the github access token used to pull code changes.
# This script is executed by the deployment of the CICD-Pipeline stack.

cd "$(dirname "${BASH_SOURCE[0]}")/.."

stack_name="$1"
token_name="$2"
aws_region="$3"

shouldCreateNewParameter="TRUE"

# If possible, propose to use existing parameter
token=$(aws ssm get-parameter --name ${token_name} --region ${aws_region} --with-decryption --output text --query Parameter.Value 2> /dev/null || echo 'not-set')

if [[ "$token" != "not-set" ]]; then
  printf "\n\nA parameter is already set in the Parameter Store: ${token_name}   ${token}"
  printf "\nDo you want to use the existing value ? (y/n)"
  read -r confirmation
  if [ "$confirmation" == "y" ]; then
    shouldCreateNewParameter="FALSE"
  fi
else
  printf "\n\nNo parameter set for your cicd's github access token at ${token_name}."
  printf "\nYou can generate a new token at https://github.com/settings/tokens"
fi

# If it's not possible, then create a new SSM Parameter
if [ "$shouldCreateNewParameter" == "TRUE" ]; then
  printf "\nPlease provide a valid token value for the new parameter ${token_name} with permission scope including [repo] and [admin:repo_hook]."
  printf "\n(token value) : "
  read -r token
  printf "\nPutting new token value in Parameter Store. (https://console.aws.amazon.com/systems-manager/parameters)."
  cmd=$(aws ssm put-parameter --overwrite --name ${token_name} --region ${aws_region} --type SecureString --value ${token})

  # Update CICD Stack accordingly
  printf "\n\nUpdating CI/CD stack ${stack_name} with Github token stored in parameter ${token_name}"

  set +e
  cmd=$(aws cloudformation update-stack \
    --stack-name ${stack_name} \
    --capabilities CAPABILITY_IAM \
    --use-previous-template \
    --region ${aws_region} \
    --parameters ParameterKey=GitHubOAuthToken,ParameterValue=${token})
  set -e
fi

printf "\n\n--> CICD is up-to-date and uses your Github access token value."
printf "\n--> You might have to re-trigger the pipeline now that it's been updated."
printf "\n--> Find your pipeline at https://console.aws.amazon.com/codesuite/codepipeline/pipelines/ and click on 'Release change'.\n"
