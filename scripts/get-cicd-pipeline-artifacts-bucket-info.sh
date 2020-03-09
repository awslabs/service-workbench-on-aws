#!/bin/bash
set -e

pushd "$(dirname ${BASH_SOURCE[0]})"
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd

# Ensure settings file exists
ensure_setttings_file "$@"

# Install
install_dependencies "$@"

function get_cicd_pipeline_artifacts_bucket_info() {
  pushd $SOLUTION_ROOT_DIR/cicd/cicd-pipeline
  local pipeline_stack_name=$($EXEC sls info -s $STAGE | grep 'stack:' --ignore-case | sed 's/ //g' | cut -d':' -f2)
  popd

  echo "pipeline_stack_name=${pipeline_stack_name}"

  local solution_name="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'solutionName:' --ignore-case | sed 's/ //g' | cut -d':' -f2)"
  local aws_region="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'awsRegion:' --ignore-case | sed 's/ //g' | cut -d':' -f2)"
  local aws_profile="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'awsProfile:' --ignore-case | sed 's/ //g' | cut -d':' -f2)"

  if [ $aws_profile ]; then
      artifacts_s3_bucket_arn="$(aws cloudformation describe-stacks --stack-name $pipeline_stack_name --output text --region $aws_region --profile $aws_profile --query 'Stacks[0].Outputs[?OutputKey==`AppArtifactBucketArn`].OutputValue')"
      artifacts_kms_key_arn="$(aws cloudformation describe-stacks --stack-name $pipeline_stack_name --output text --region $aws_region --profile $aws_profile --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketKeyArn`].OutputValue')"
  else
      artifacts_s3_bucket_arn="$(aws cloudformation describe-stacks --stack-name $pipeline_stack_name --output text --region $aws_region --query 'Stacks[0].Outputs[?OutputKey==`AppArtifactBucketArn`].OutputValue')"
      artifacts_kms_key_arn="$(aws cloudformation describe-stacks --stack-name $pipeline_stack_name --output text --region $aws_region --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketKeyArn`].OutputValue')"
  fi

  printf "\n\n\n-------------------------------------------------------------------------"
  printf "\nCI/CD Pipeline Artifacts Bucket Info:"
  printf "\n-------------------------------------------------------------------------"
  printf "\n\nArtifacts Bucket Arn (AppArtifactBucketArn)   : ${artifacts_s3_bucket_arn}"
  printf "\nArtifacts KMS Key Arn (ArtifactBucketKeyArn)      : ${artifacts_kms_key_arn}"
  printf "\n\n-------------------------------------------------------------------------\n\n"
}

get_cicd_pipeline_artifacts_bucket_info