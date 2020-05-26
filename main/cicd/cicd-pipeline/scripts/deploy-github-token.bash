#!/usr/bin/env bash
set -e


stack_name="$1"
token_name="$2"


token=$(aws ssm get-parameter --name ${token_name} --with-decryption --output text --query Parameter.Value 2> /dev/null || echo 'not-found')

if [[ $token != 'not-found' ]]; then
  aws cloudformation update-stack \
    --stack-name ${stack_name} \
    --capabilities CAPABILITY_IAM \
    --use-previous-template \
    --parameters ParameterKey=GitHubOAuthToken,ParameterValue=${token}
fi
