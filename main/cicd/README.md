# CI/CD Pipeline for the solution

## Terms

**Source Account:** AWS Account containing CodeCommit repository with the source code

**Target Account:** AWS Account where the solution needs to be deployed to. The CodePipeline is also deployed in the target account.

**Staging Environment:** Solution environment created to run integration tests or manual tests before deploying the solution to final target environment.

**Target Environment:** Target solution environment where the code needs to be deployed.

## How does the pipeline work?
At high level the pipeline works as follows:
  1. Every commit in the source account on the configured repo for the specified branch triggers a CloudWatch event 
  2. A CloudWatch Rule pushes the event to the default event bus of the target account
  3. A CloudWatch Rule in the target account triggers the CodePipeline.
  4. The pipeline contains the following stages and executes them in order. 
The pipeline stops upon failure of any stage and notifies user via configured SNS topic. 
    
  4.1 **Source:** This stage takes the code from the CodeCommit repository from the specified branch and uploads it to 
  an S3 bucket. This S3 bucket is called artifacts bucket and is used by the CodePipeline to pass artifacts from one 
  stage to other stage.

  4.2 **Build-And-Deploy-To-Stagging-Env:** This stage uses [AWS CodeBuild](https://aws.amazon.com/codebuild/) to 
  perform build and deployment. It downloads the code from the artifacts S3 bucket and installs dependencies, performs 
  the static code analysis, runs unit tests, and deploys to the staging environment. This stage is only created if 
  `createStagingEnv` setting is set to `true` in settings file. Developers can set `createStagingEnv` to `false` to skip 
  creation and deployment to staging environment and directly push changes to their target development environment. This 
  flag should be set to `true` for higher environments (such as `demo` or `production`) to make sure code is deployed and 
  tested in a staging environment before pushing to target environment.

  4.3 **Test-Staging-Env:** This stage uses [AWS CodeBuild](https://aws.amazon.com/codebuild/) to execute integration 
  tests against the staging environment. This stage is only created if `createStagingEnv` setting is set to `true` in 
  settings file. Developers can set `createStagingEnv` to `false` to skip creation and deployment to staging environment 
  and directly push changes to their target development environment.

  4.4 **Push-To-Target-Env:** This stage is for manual approval to deploy to target environment. The pipeline will pause
  at this stage and wait for manual approval. The user will receive an email notification via configured SNS topic. The 
  notification email address is configured via the setting `emailForNotifications` in the settings file. This stage is 
  only created if `requireManualApproval` setting is set to `true` in settings file. Setting `requireManualApproval` 
  to `false` will cause auto-propagation to the target environment. 

  4.5 **Build-and-Deploy-to-Target-Env:** This stage uses [AWS CodeBuild](https://aws.amazon.com/codebuild/) to perform 
  build and deployment. It downloads the code from the artifacts S3 bucket and installs dependencies, performs the 
  static code analysis, runs unit tests, and deploys to the target environment.
  
  4.6 **Test-Target-Env:** This stage uses [AWS CodeBuild](https://aws.amazon.com/codebuild/) to execute integration 
  tests against the target environment. This stage is only created if `runTestsAgainstTargetEnv` setting is set to 
  `true` in settings file. Developers can set `createStagingEnv` to `false`, `requireManualApproval` to `false`, and 
  `runTestsAgainstTargetEnv` to `true` to skip creation and deployment to staging environment and directly push changes 
  to their target development environment without requiring manual approval and run integration tests directly against 
  their target development environment.

## How to deploy the CI/CD Pipeline

1. Deploy `cicd-source` stack to the Source Account
  
  * Create a settings file in `cicd/cicd-source/config/settings` for the environment for which you want to create the 
  CI/CD pipeline. For example, to create the CI/CD pipeline for `dev` environment, create `dev.yml` file in 
  `cicd/cicd-source/config/settings/`. You can create the settings file by copying the sample `example-codecommit.yml` file. 
  Please adjust the settings as per your environment. Read inline comments in the file for information about each 
  setting.
  
  Set the following settings as `"*"`
  ```
    artifactsS3BucketArn: "*"
    artifactsKmsKeyArn: "*" 
  ```
   
  * Deploy the `cicd-source` stack.
  ```bash
    cd cicd/cicd-source

    pnpx sls deploy --stage <env-name>
  ```

2. Deploy `cicd-pipeline` stack to the Target Account

  * Create a settings file in `cicd/cicd-pipeline/config/settings` for the environment for which you want to create the 
  CI/CD pipeline. For example, to create the CI/CD pipeline for `dev` environment, create `dev.yml` file in 
  `cicd/cicd-pipeline/config/settings/`. You can create the settings file by copying the sample `example-codecommit.yml` file. 
  Please adjust the settings as per your environment. Read inline comments in the file for information about each 
  setting.

  * Edit the settings file in `main/config/settings` for the environment. Comment out the line that states the `awsProfile`.
   
  * Deploy the `cicd-pipeline` stack.
  ```bash
    cd cicd/cicd-pipeline

    pnpx sls deploy --stage <env-name>
  ```

3. Re-deploy `cicd-source` stack to the Source Account to lock down permissions for the artifacts bucket

  * Note down the CloudFormation stack output variables `AppArtifactBucketArn` and `ArtifactBucketKeyArn` from the 
  `cicd-pipeline` stack you deployed in step 2 above. 
    
  You can use `sls info` command with `--verbose` flag to print stack output variables as follows.
    
  * CD to the `cicd/cicd-pipeline` 
  ```bash
    pnpx sls info --verbose -s <env-name>
  ```

  * Set the CloudFormation stack output variables `AppArtifactBucketArn`
  and `ArtifactBucketKeyArn` that you obtained above in the settings `artifactsS3BucketArn` and `artifactsKmsKeyArn`
  in settings file `cicd/cicd-source/config/settings/demo.yml` then re-deploy the `cicd-source` 
  stack to lock down the permissions in `CodeCommitSourceRole`
  ```
    artifactsS3BucketArn: "<value of the CloudFormation output variable AppArtifactBucketArn from cicd-pipeline stack>"
    artifactsKmsKeyArn: "<value of the CloudFormation output variable ArtifactBucketKeyArn from cicd-pipeline stack>" 
  ```
  
  * CD to the `cicd/cicd-source` 
 
  * Deploy the `cicd-source` stack.
  ```bash
    cd cicd/cicd-source
  
    pnpx sls deploy --stage <env-name>
  ```