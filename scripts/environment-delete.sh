#!/bin/bash
set -e

cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh

function removeComponentWithNoStack () {
    local COMPONENT_NAME=$1
    local COMPONENT_DIR=$2
    local ASK_CONFIRMATION=$3

    local shouldRemoveComponent="FALSE"

    printf "\n\n\n--- Component $COMPONENT_NAME (with no stack)\n"
    cd "$COMPONENT_DIR"

    if [[ "$ASK_CONFIRMATION" != "DONT_ASK_CONFIRMATION" ]]; then
        printf "\nDo you want to remove component $COMPONENT_NAME ? (y/n): "
        read -r confirmation
        if [[ "$confirmation" == "y" ]]; then
            shouldRemoveComponent="TRUE"
        fi
    else
        shouldRemoveComponent="TRUE"
    fi

    if [ "$shouldRemoveComponent" == "TRUE" ]; then
        printf "\nRemoving Component $COMPONENT_NAME ...\n"
        $EXEC sls remove -s "$STAGE"
    fi
}

function removeStack () {
    local COMPONENT_NAME=$1
    local COMPONENT_DIR=$2
    local ASK_CONFIRMATION=$3

    local stackName
    local shouldBeRemoved

    printf "\n\n\n--- Stack $COMPONENT_NAME\n"
    cd "$COMPONENT_DIR"
    shouldStackBeRemoved $ASK_CONFIRMATION stackName shouldBeRemoved

    if [[ "$shouldBeRemoved" == "TRUE" && "$stackName" != "NO_STACK" ]]; then
        printf "\nRemoving stack $COMPONENT_NAME ...\n"
        $EXEC sls remove -s "$STAGE"
    fi
}

function shouldStackBeRemoved () {

    local output_stackName=$2
    local output_shouldBeRemoved=$3

    local __askConfirmation=$1
    local __confirmation
    local __stackName
    local __shouldBeRemoved="FALSE"

    # Ask if current folder stack info and temporarily accept errors
    set +e
    local stackInfo=$($EXEC sls info -s "$STAGE")
    set -e

    if [[ "$stackInfo" == *"security token"* ]]; then
        printf "\n\nERROR: AWS Token expired. Please check that you stored appropriate aws credentials.\n\n"
        exit 1
    elif [[ "$stackInfo" != *"Serverless Error"* ]]; then
        # If stack exists retrieve its name and ask confirmation from user
        __stackName="$(grep 'stack:' --ignore-case <<<$stackInfo | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
        if [[ "$__stackName" != "NO_STACK" ]]; then
            if [ "$__askConfirmation" != "DONT_ASK_CONFIRMATION" ]; then
                printf "\nStack [$__stackName] is up and running. Do you want to remove it ? (y/n): "
                read -r __confirmation
                if [ "$__confirmation" == "y" ]; then
                    __shouldBeRemoved="TRUE"
                fi
            else
                __shouldBeRemoved="TRUE"
            fi
        fi
    else
        __stackName="NO_STACK"
    fi

    # Return-like statements
    eval $output_stackName=$__stackName
    eval $output_shouldBeRemoved=$__shouldBeRemoved
}

function removeCfLambdaAssociations () {
    local stackName
    local __novar

    printf "\n\n\n--- Edge Lambda Associations in Cloudfront Distribution\n"
    cd "$SOLUTION_DIR/infrastructure"
    shouldStackBeRemoved "DONT_ASK_CONFIRMATION" stackName __novar
    
    if [[ "$stack" != "NO_STACK" ]]; then

        # Find information about the Cluodfront Distribution
        local region=$(grep '^awsRegion:' --ignore-case < "$CONFIG_DIR/settings/$STAGE.yml" | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
        local distributionId=$(aws cloudformation describe-stacks --stack-name "$stackName" --output text --region "$region" --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontId`].OutputValue')

        printf "\nRemoving Edge Lambda Associations from Cloudfront Distribution $distributionId ..."

        # Retrieve distribution configuration
        local response=$(aws cloudfront get-distribution-config --id "$distributionId" | jq '.')

        # Keep ETag for later, and save up-to-date configuration with no Lambda associations in a temporary json file
        local ETag=$(jq '.ETag' <<<$response | tr -d \") 
        local distributionConfig=$(jq '.DistributionConfig' <<<$response)
        
        currentAssociations=$(jq '.DefaultCacheBehavior.LambdaFunctionAssociations' <<<$distributionConfig)
        jsonString='{ "Quantity": 0 }'
        noAssociations=$(jq '.' <<<$jsonString)

        if [[ "$currentAssociations" != "$jsonString" ]]; then
            # Update Cloudfront Distribution
            jq '.DefaultCacheBehavior.LambdaFunctionAssociations = { "Quantity": 0 }' <<<$distributionConfig > temp_cf_config.json
            cmd=$(aws cloudfront update-distribution --distribution-config file://temp_cf_config.json --id $distributionId --if-match $ETag)
            rm temp_cf_config.json
            printf "\nDone !"
        else
            printf "\nNo need to update config. currentAssociations: $currentAssociations"
        fi
    
    fi
}

function removeVersionedBucket () {

    set +e # Avoid interrupting this script in case an exception such as NoSuchBucket is raised.

    local bucket=$1
    printf "\n\n\n--- CICD AppArtifactBucket $bucket\n"

    printf "\nRemoving all versions from bucket ..."
    versions=$(aws s3api list-object-versions --bucket $bucket |jq '.Versions')
    let count=$(echo $versions |jq 'length')-1
    if [ $count -gt -1 ]; then
        for i in $(seq 0 $count); do
            key=$(echo $versions | jq .[$i].Key |sed -e 's/\"//g')
            versionId=$(echo $versions | jq .[$i].VersionId |sed -e 's/\"//g')
            printf "cmd: aws s3api delete-object --bucket $bucket --key $key --version-id $versionId"
            cmd=$(aws s3api delete-object --bucket $bucket --key $key --version-id $versionId)
        done
    fi

    printf "\nRemoving all markers from bucket ..."
    markers=$(aws s3api list-object-versions --bucket $bucket |jq '.DeleteMarkers')
    let count=$(echo $markers |jq 'length')-1
    if [ $count -gt -1 ]; then
        for i in $(seq 0 $count); do
            key=$(echo $markers | jq .[$i].Key |sed -e 's/\"//g')
            versionId=$(echo $markers | jq .[$i].VersionId |sed -e 's/\"//g')
            cmd=$(aws s3api delete-object --bucket $bucket --key $key --version-id $versionId)
        done
    fi

    printf "\nRemoving S3 bucket ..."
    cmd=$(aws s3api delete-bucket --bucket $deploymentBucketName --region $region)

    set -e
}

function removeCICDStacks () {

    local ASK_CONFIRMATION=$1

    local stackName
    local shouldBeRemoved

    printf "\n\n\n--- CICD STACKS\n"

    cd "$SOLUTION_ROOT_DIR/main/cicd/cicd-pipeline"
    shouldStackBeRemoved $ASK_CONFIRMATION stackName shouldBeRemoved

    if [[ "$shouldBeRemoved" == "TRUE" && "$stackName" != "NO_STACK" ]]; then
        # Remove versioned bucket used by CICD-Pipelin (AppArtifactBucket)
        region=$(grep '^awsRegion:' --ignore-case < "$CONFIG_DIR/settings/$STAGE.yml" | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
        deploymentBucketName=$(aws cloudformation describe-stacks --stack-name "$stackName" --output text --region "$region" --query 'Stacks[0].Outputs[?OutputKey==`AppArtifactBucketName`].OutputValue')
        removeVersionedBucket $deploymentBucketName

        removeStack "CICD-Pipeline" "$SOLUTION_ROOT_DIR/main/cicd/cicd-pipeline" "DONT_ASK_CONFIRMATION"
    fi
    
    printf "\n"

    cd "$SOLUTION_ROOT_DIR/main/cicd/cicd-source"
    shouldStackBeRemoved $ASK_CONFIRMATION stackName shouldBeRemoved

    if [[ "$shouldBeRemoved" == "TRUE" && "$stackName" != "NO_STACK" ]]; then
        removeStack "CICD-Pipeline" "$SOLUTION_ROOT_DIR/main/cicd/cicd-source" "DONT_ASK_CONFIRMATION"
    fi
}

function removeSsmParams () {
    local ASK_CONFIRMATION=$1
    
    local solutionName=$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" | grep '^solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
    local regionName=$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" | grep '^awsRegion:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')

    local param_jwtSecret="/$STAGE/$solutionName/jwt/secret"
    local param_rootUserPwd="/$STAGE/$solutionName/user/root/password"
    local param_githubToken="/$STAGE/$solutionName/github/token"

    printf "\n\n\n---- SSM Parameters"
    local paramNames=( "$param_rootUserPwd" "$param_jwtSecret" "$param_githubToken" )
    local _confirmation="y"

    for param in "${paramNames[@]}"
    do
        if [ "$ASK_CONFIRMATION" != "DONT_ASK_CONFIRMATION" ]; then
            printf "\nRemove param $param ? (y/n): "
            read -r _confirmation
        fi

        if [ "$_confirmation" == "y" ]; then
            set +e
            aws ssm delete-parameter --region $regionName --name $param
            set -e
        fi
    done
}

# Ask for confirmation to begin removal procedure
printf "\n\n\n ****** WARNING ******"
printf "\nTHIS COMMAND WILL HELP YOU CLEAN UP YOUR ENVIRONMENT STACKS AND LEAD TO DATA LOSS."
printf "\nAre you sure you want to proceed to the deletion the stacks of the environment [$STAGE] ?"
printf "\nType the environment name to confirm the removal : "
read -r confirmation
if [[ "$STAGE" != "$confirmation" ]]; then
    printf "\n\nConfirmation mismatch. Exiting.\n\n"
    exit 1
fi

printf "\n\nStarting to clear the application for stage [$STAGE] ...\n"

removeComponentWithNoStack "UI" "$SOLUTION_DIR/ui" "DONT_ASK_CONFIRMATION"

removeStack "Post-Deployment" "$SOLUTION_DIR/post-deployment" "DONT_ASK_CONFIRMATION"

removeCfLambdaAssociations

removeStack "Edge-Lambda" "$SOLUTION_DIR/edge-lambda" "DONT_ASK_CONFIRMATION"

removeStack "Backend" "$SOLUTION_DIR/backend" "DONT_ASK_CONFIRMATION"

removeStack "Infrastructure" "$SOLUTION_DIR/infrastructure" "DONT_ASK_CONFIRMATION"

removeCICDStacks "ASK_CONFIRMATION"

removeSsmParams "ASK_CONFIRMATION"

printf "\n\n*******************************************************************"
printf "\n*****     ----- ENVIRONMENT DELETED SUCCESSFULLY !! -----     *****"
printf "\n*******************************************************************"
printf "\nYou still have to remove the following elements :"
printf "\n  -[Edge lambda]: It can be deleted manually in 1 hour,"
printf "\n     see it at https://console.aws.amazon.com/lambda"
printf "\n  -[Consumer Accounts]: The resources deployed on your"
printf "\n     AWS consumer accounts will still be there."
printf "\n     see at "
printf "\n       https://console.aws.amazon.com/ec2/v2/home,"
printf "\n       https://console.aws.amazon.com/sagemaker/home )"
printf "\n\n\n"
