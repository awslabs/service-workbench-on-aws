#!/bin/bash
set -e

cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh

init_package_manager

function removeComponentWithNoStack() {
    local COMPONENT_NAME=$1
    local COMPONENT_DIR=$2
    local ASK_CONFIRMATION=$3

    local shouldRemoveComponent="FALSE"

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
        printf "\n- Removing Component $COMPONENT_NAME ... \n"
        set +e
        $EXEC sls remove -s "$STAGE"
        set -e
    fi
}

function removeStack() {
    local COMPONENT_NAME=$1
    local COMPONENT_DIR=$2
    local ASK_CONFIRMATION=$3
    local bucket_names=("${@:4}")

    local stackName
    local shouldBeRemoved

    cd "$COMPONENT_DIR"
    shouldStackBeRemoved $ASK_CONFIRMATION stackName shouldBeRemoved

    if [[ "$shouldBeRemoved" == "TRUE" && "$stackName" != "NO_STACK" ]]; then
        emptyS3BucketsFromNames "DO_NOT_DELETE" "DONT_ASK_CONFIRMATION" ${bucket_names[@]}
        printf "\n- Removing Stack $COMPONENT_NAME ...\n"
        set +e
        $EXEC sls remove -s "$STAGE"
        set -e
    fi
}

function shouldStackBeRemoved() {

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
                printf "\nDo you want to remove the stack $__stackname ? (y/n): "
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

function removeCfLambdaAssociations() {
    set +e # Avoid interrupting this script in case of an exception
    local lambdaFunctionName=$1
    if [[ "$functionName" != "" ]]; then
        aws lambda delete-function --function-name $lambdaFunctionName
    fi
    set -e
}

function getCfLambdaAssociations() {

    set +e # Avoid interrupting this script in case of an exception

    # Find information about the Cloudfront Distribution
    local region=$(grep '^awsRegion:' --ignore-case <"$CONFIG_DIR/settings/$STAGE.yml" | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
    local aws_region_shortname=$(cat $CONFIG_DIR/settings/.defaults.yml | grep \'$region\' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015' | tr -d "'")
    local solutionName=$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" | grep '^solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
    local stackName="$STAGE-$aws_region_shortname-$solutionName-infrastructure"
    local distributionId=$(aws cloudformation describe-stacks --stack-name "$stackName" --output text --region "$region" --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontId`].OutputValue')

    printf "\n-> Removing Edge Lambda Associations from Cloudfront Distribution $distributionId ..."

    # Retrieve distribution configuration
    local response=$(aws cloudfront get-distribution-config --id "$distributionId" | jq '.')

    # Keep ETag for later, and save up-to-date configuration with no Lambda associations in a temporary json file
    local ETag=$(jq '.ETag' <<<$response | tr -d \")
    local distributionConfig=$(jq '.DistributionConfig' <<<$response)

    currentAssociations=$(jq '.DefaultCacheBehavior.LambdaFunctionAssociations' <<<$distributionConfig)
    jsonString='{ "Quantity": 0 }'
    noAssociations=$(jq '.' <<<$jsonString)
    local __funcName=""

    if [[ "$currentAssociations" != "$jsonString" ]]; then
        # Update Cloudfront Distribution
        jq '.DefaultCacheBehavior.LambdaFunctionAssociations = { "Quantity": 0 }' <<<$distributionConfig >temp_cf_config.json
        cmd=$(aws cloudfront update-distribution --distribution-config file://temp_cf_config.json --id $distributionId --if-match $ETag)
        rm temp_cf_config.json
        printf "\nCloudFront separated from Edge Lambda function.\n"
        local edgeLambdaARN=$(jq -r '.Items[0].LambdaFunctionARN' <<<$currentAssociations)
        __funcName="$(grep -o "$STAGE-[^:]*\b" <<<$edgeLambdaARN)"
    else
        printf "\nNo need to update config. currentAssociations: $currentAssociations"
    fi

    # Return-like statement
    echo "$__funcName"
    set -e
}

function emptyS3Bucket() {

    set +e # Avoid interrupting this script in case an exception such as NoSuchBucket is raised.

    local bucket=$1
    local region=$2
    local delete_option=$3

    blank="                                                                                                                        "
    message="\\r$blank\\r- Emptying bucket $bucket ... "
    printf "\n$message"

    # Remove Versions for all objects
    versions=$(aws s3api list-object-versions --bucket $bucket | jq '.Versions')
    let count=$(echo $versions | jq 'length')-1
    if [ $count -gt -1 ]; then
        for i in $(seq 0 $count); do
            printf "$message Removing objects versions : $i/$count"
            key=$(echo $versions | jq .[$i].Key | sed -e 's/\"//g')
            versionId=$(echo $versions | jq .[$i].VersionId | sed -e 's/\"//g')
            cmd=$(aws s3api delete-object --bucket $bucket --key $key --version-id $versionId)
        done
    fi

    # Remove Markers
    markers=$(aws s3api list-object-versions --bucket $bucket | jq '.DeleteMarkers')
    let count=$(echo $markers | jq 'length')-1
    if [ $count -gt -1 ]; then
        for i in $(seq 0 $count); do
            printf "$message Removing markers : $i/$count"
            key=$(echo $markers | jq .[$i].Key | sed -e 's/\"//g')
            versionId=$(echo $markers | jq .[$i].VersionId | sed -e 's/\"//g')
            cmd=$(aws s3api delete-object --bucket $bucket --key $key --version-id $versionId)
        done
    fi
    printf "$message Done !"

    if [ $delete_option == "DELETE_AFTER_EMPTYING" ]; then
        printf "\n- Deleting bucket $bucket ... "
        cmd=$(aws s3api delete-bucket --bucket $bucket --region $region)
        printf "Done !"
    fi
    set -e
}

function emptyS3BucketsFromNames() {

    set +e # Avoid interrupting this script in case an exception such as NoSuchBucket is raised.

    local deleteBucket=$1
    local ASK_CONFIRMATION=$2
    local buckets_to_remove=("${@:3}")
    local __shouldBeRemoved="FALSE"

    if [ "$ASK_CONFIRMATION" != "DONT_ASK_CONFIRMATION" ]; then
        printf "\nDo you want to remove the buckets ($buckets_to_remove) ? (y/n): "
        read -r __confirmation
        if [ "$__confirmation" == "y" ]; then
            __shouldBeRemoved="TRUE"
        fi
    else
        __shouldBeRemoved="TRUE"
    fi

    if [ "$__shouldBeRemoved" == "TRUE" ]; then
        local aws_region="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'awsRegion:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
        local aws_region_shortname=$(cat $CONFIG_DIR/settings/.defaults.yml | grep \'$aws_region\' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015' | tr -d "'")
        local solution_name="$(cat $CONFIG_DIR/settings/$STAGE.yml $CONFIG_DIR/settings/.defaults.yml | grep 'solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
        local account_number=$(aws sts get-caller-identity --query Account --output text)
        local bucket_prefix="$account_number-$STAGE-$aws_region_shortname-$solution_name"

        for bucket_to_remove in "${buckets_to_remove[@]}"; do
            local bucket="$bucket_prefix-$bucket_to_remove"
            emptyS3Bucket $bucket $aws_region $deleteBucket
        done
    fi

    set -e
}

function removeSsmParams() {

    set +e

    local solutionName=$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" | grep '^solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
    local regionName=$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" | grep '^awsRegion:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')

    printf "\n\n\n---- SSM Parameters"
    local paramNames=("/$STAGE/$solutionName/jwt/secret" "/$STAGE/$solutionName/user/root/password")

    for param in "${paramNames[@]}"; do
        set +e
        printf "\nDeleting param $param"
        aws ssm delete-parameter --name $param > /dev/null
        set -e
    done

    set -e
}

function removeServiceCatalogPortfolio() {
    set +e

    local aws_region="$(cat $CONFIG_DIR/settings/$STAGE.yml | grep 'awsRegion:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')"
    local aws_region_shortname=$(cat $CONFIG_DIR/settings/.defaults.yml | grep \'$aws_region\' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015' | tr -d "'")
    local solutionName=$(cat "$CONFIG_DIR/settings/$STAGE.yml" "$CONFIG_DIR/settings/.defaults.yml" | grep '^solutionName:' -m 1 --ignore-case | sed 's/ //g' | cut -d':' -f2 | tr -d '\012\015')
    local portfolioId=$(aws dynamodb get-item --region $aws_region --table-name "$STAGE-$aws_region_shortname-$solutionName-DeploymentStore" --key '{"type": {"S": "default-sc-portfolio"}, "id": {"S": "default-SC-portfolio-1"}}' --output text | grep -o 'port-[^"]*\b')
    
    if [[ "$portfolioId" != "" ]]; then
        local constraintIds=$(aws servicecatalog list-constraints-for-portfolio --region $aws_region --portfolio-id "$portfolioId" --query "ConstraintDetails[].ConstraintId" --output text)
        constraintIds=(`echo ${constraintIds}`)
        local productIds=$(aws servicecatalog list-constraints-for-portfolio --region $aws_region --portfolio-id "$portfolioId" --query "ConstraintDetails[].ProductId" --output text)
        productIds=(`echo ${productIds}`)
        local principals=$(aws servicecatalog list-principals-for-portfolio --region $aws_region --portfolio-id "$portfolioId" --query "Principals[].PrincipalARN" --output text)
        principals=(`echo ${principals}`)
        
        for constraint in "${constraintIds[@]}"; do
            aws servicecatalog --region $aws_region delete-constraint --id $constraint > /dev/null
        done

        for product in ${productIds[@]}; do
            aws servicecatalog --region $aws_region disassociate-product-from-portfolio --product-id $product --portfolio-id $portfolioId > /dev/null
            aws servicecatalog --region $aws_region delete-product --id $product > /dev/null
        done

        for principal in ${principals[@]}; do
            aws servicecatalog --region $aws_region disassociate-principal-from-portfolio --portfolio-id $portfolioId --principal-arn $principal > /dev/null
        done

        aws servicecatalog --region $aws_region delete-portfolio --id $portfolioId > /dev/null
    fi
    
    set -e
}

# Ask for confirmation to begin removal procedure
printf "\n\n\n ****** WARNING ******"
printf "\nTHIS COMMAND WILL HELP YOU CLEAN UP YOUR ENVIRONMENT STACKS AND LEAD TO DATA LOSS."
printf "\nAre you sure you want to proceed to the deletion of the resources of the environment [$STAGE] ?"
printf "\nType the environment name to confirm the removal : "
read -r confirmation
if [[ "$STAGE" != "$confirmation" ]]; then
    printf "\n\nConfirmation mismatch. Exiting.\n\n"
    exit 1
fi

printf "\n\nStarting to clear the application for stage [$STAGE] ...\n"

# -- Service Catalog portfolio
printf "\n\n\n--- Removing associated Service Catalog portfolio\n"
removeServiceCatalogPortfolio

# -- UI
printf "\n\n\n--- UI builds\n"
removeComponentWithNoStack "UI" "$SOLUTION_DIR/ui" "DONT_ASK_CONFIRMATION"

# -- Post-Deployment stack
printf "\n\n\n--- Post-Deployment stack\n"
removeStack "Post-Deployment" "$SOLUTION_DIR/post-deployment" "DONT_ASK_CONFIRMATION"

# -- Edge-Lambda stack
printf "\n\n\n--- Edge-Lambda stack"
removeStack "Edge-Lambda" "$SOLUTION_DIR/edge-lambda" "DONT_ASK_CONFIRMATION"

# -- Backend stack
printf "\n\n\n--- Backend stack"
buckets=("studydata" "external-templates" "env-type-configs" "environments-bootstrap-scripts")
removeStack "Backend" "$SOLUTION_DIR/backend" "DONT_ASK_CONFIRMATION" ${buckets[@]}

# -- Pre-Deployment stack
printf "\n\n\n--- Pre-Deployment stack\n"
removeStack "Pre-Deployment" "$SOLUTION_DIR/pre-deployment" "DONT_ASK_CONFIRMATION"

# -- Infrastructure stack
printf "\n\n\n--- Infrastructure stack"
edgeLambdaFunctionName=$(getCfLambdaAssociations)
buckets=("website" "logging")
removeStack "Infrastructure" "$SOLUTION_DIR/infrastructure" "DONT_ASK_CONFIRMATION" ${buckets[@]}

# -- Prep-Master stack (master role)
printf "\n\n\n--- Master-Account-Role stack"
buckets=("raas-master-artifacts")
removeStack "Prep-Master-Account" "$SOLUTION_DIR/prepare-master-acc" "DONT_ASK_CONFIRMATION"
# The '-raas-master-artifacts' bucket is the deployment bucket and has to be removed after the stack deletion
emptyS3BucketsFromNames "DELETE_AFTER_EMPTYING" "DONT_ASK_CONFIRMATION" ${buckets[@]}

# -- Machine images
printf "\n\n\n--- Machine Images stack"
removeStack "Machine-Images" "$SOLUTION_DIR/machine-images" "DONT_ASK_CONFIRMATION"

# -- CICD
printf "\n\n\n--- CICD"
buckets=("cicd-appartifacts")
removeStack "CICD-Pipeline" "$SOLUTION_ROOT_DIR/main/cicd/cicd-pipeline" "ASK_CONFIRMATION" ${buckets[@]}
removeStack "CICD-Source" "$SOLUTION_ROOT_DIR/main/cicd/cicd-source" "ASK_CONFIRMATION" ${buckets[@]}

# -- Deployment buckets
printf "\n\n\n--- Deployment buckets"
buckets=("artifacts")
emptyS3BucketsFromNames "DELETE_AFTER_EMPTYING" "ASK_CONFIRMATION" ${buckets[@]}

# -- SSM parameters
removeSsmParams

# -- Lambda@edge associations in Cloudfront (if Cloudfront has not been deleted yet)
printf "\n\n\n--- Edge Lambda Associations in Cloudfront Distribution\n"
removeCfLambdaAssociations $edgeLambdaFunctionName

printf "\n\n*******************************************************************"
printf "\n*****     ----- ENVIRONMENT DELETED SUCCESSFULLY  🎉!! -----     *****"
printf "\n*******************************************************************"
printf "\nYou still have to remove the following elements :"
printf "\n  -[Edge lambda]: It can be deleted manually in 1 hour,"
printf "\n     Navigate here on the main account:"
printf "\n       https://console.aws.amazon.com/lambda"
printf "\n  -[Consumer Accounts]: The stacks and resources deployed on your"
printf "\n     hosting accounts are not deleted as part of this script"
printf "\n     Navigate here on those accounts:"
printf "\n       https://console.aws.amazon.com/ec2/v2/home,"
printf "\n       https://console.aws.amazon.com/sagemaker/home"
printf "\n       https://console.aws.amazon.com/cloudformation"
printf "\n\n\n"
