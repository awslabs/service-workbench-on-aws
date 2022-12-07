# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [5.2.4](https://github.com/awslabs/service-workbench-on-aws/compare/v5.2.3...v5.2.4) (2022-12-07)


### Features

* Add integration tests for users and user-roles controllers ([#1057](https://github.com/awslabs/service-workbench-on-aws/issues/1057)) ([5e9e813](https://github.com/awslabs/service-workbench-on-aws/commit/5e9e81306db7c2da220b2f04007b884e0dbdcde3))


### Bug Fixes

* fix input validation and escape html on popups ([#1075](https://github.com/awslabs/service-workbench-on-aws/issues/1075)) ([bbe1e20](https://github.com/awslabs/service-workbench-on-aws/commit/bbe1e2067c9297dc5f288307bd48ec8170fe8304))
* minimatch alert ([#1058](https://github.com/awslabs/service-workbench-on-aws/issues/1058)) ([3eb90c9](https://github.com/awslabs/service-workbench-on-aws/commit/3eb90c950be3521c5c4ca5b3f82e8a40ac1c7edf))

### [5.2.3](https://github.com/awslabs/service-workbench-on-aws/compare/v5.2.2...v5.2.3) (2022-10-12)


### Bug Fixes

* upgrade lambda nodejs to 16x and Serverless Framework to v3([#1047](https://github.com/awslabs/service-workbench-on-aws/pull/1047))([a0c7eee](https://github.com/awslabs/service-workbench-on-aws/commit/a0c7eeed34eea02ec56f49411cf499d1c59f0d3a))
* tre egress store data updated S3 return ([#1054](https://github.com/awslabs/service-workbench-on-aws/issues/1054)) ([a80aa7e](https://github.com/awslabs/service-workbench-on-aws/commit/a80aa7eac48ed4052e17627b8e369b38ffa9ae31))
* use "" as default profile if no awsProfile ([#1050](https://github.com/awslabs/service-workbench-on-aws/issues/1050)) ([863cb06](https://github.com/awslabs/service-workbench-on-aws/commit/863cb06588084ea3026b0dd08dbf71ee3f4ffb80))

### [5.2.2](https://github.com/awslabs/service-workbench-on-aws/compare/v5.2.1...v5.2.2) (2022-09-02)


### Bug Fixes

* allow Guest users to log in ([#1031](https://github.com/awslabs/service-workbench-on-aws/issues/1031)) ([6072b4e](https://github.com/awslabs/service-workbench-on-aws/commit/6072b4e5c7dcb7ace0bcf1548c2d6bfb1921d29b))

### [5.2.1](https://github.com/awslabs/service-workbench-on-aws/compare/v5.2.0...v5.2.1) (2022-09-01) 


### Bug Fixes

* appstream image version update ([#1022](https://github.com/awslabs/service-workbench-on-aws/issues/1022)) ([99880b3](https://github.com/awslabs/service-workbench-on-aws/commit/99880b3277d9c56948fc81cb6711669d8821f3ae))
* cicd pipeline S3 config check fail  ([#1025](https://github.com/awslabs/service-workbench-on-aws/issues/1025)) ([21713f7](https://github.com/awslabs/service-workbench-on-aws/commit/21713f7b1b9749bdca67eaea7e334848acbe34bf))
* dependabot resolution for got package ([#1008](https://github.com/awslabs/service-workbench-on-aws/issues/1008)) ([8619c6e](https://github.com/awslabs/service-workbench-on-aws/commit/8619c6e0aeaaa31346155115be64cd316fb43e22))
* remove permission for Guest to list users ([#1028](https://github.com/awslabs/service-workbench-on-aws/issues/1028)) ([e88eca4](https://github.com/awslabs/service-workbench-on-aws/commit/e88eca466cbcf718b1d350f968e2fd45a376da8e))

### [5.2.0](https://github.com/awslabs/service-workbench-on-aws/compare/v5.1.1...v5.2.0) (2022-05-17)


### Features

* TRE Enhancements  ([#993](https://github.com/awslabs/service-workbench-on-aws/issues/993)) ([a843926](https://github.com/awslabs/service-workbench-on-aws/commit/a8439261949f00c18f2a761518036a9756676235)):
  - **Support for Centralized AMI**:  Allows customers to use a centralized DevOps account for building and hosting AMIs so that these AMIs can be made available to multiple SWB installations.
    - `enableAmiSharing` and `devopsProfile` configuration settings have been added, disabled by default. These can be overriden in your `main/config/settings/<stage>.yml` file.
  - **Restrict access to data for Admin Role**: The admin will be allowed to view another researchers' workspaces in the Service Workbench portal, but will not be able connect to them. This ensures the admins do not get indirect access to data sources of other users. Admins can also be restricted to being BYOB data source owners without being a BYOB study admins.
    - `restrictAdminWorkspaceConnection` and `disableAdminBYOBSelfAssignment` configuration settings have been added, disabled by default. These can be overriden in your `main/config/settings/<stage>.yml` file.
  - **Restricted data upload capabilities for Researcher Profile**: Users with a researcher role will not have the ability to create a study or upload files to any study, allowing organization to have more control over the study creation and data ingestion.
    - `disableStudyUploadByResearcher` configuration setting has been added, disabled by default. This can be overriden in your `main/config/settings/<stage>.yml` file.

  For more information about these flags, please take a look at our [User Guide](./docs/Service_Workbench_User_Guide.pdf) document.

### Bug Fixes

* create log group for flow logs ([#984](https://github.com/awslabs/service-workbench-on-aws/issues/984)) ([5c51e97](https://github.com/awslabs/service-workbench-on-aws/commit/5c51e97c783246136b7d0792367a2050b64d7380))
* first install ([#970](https://github.com/awslabs/service-workbench-on-aws/issues/970)) ([24010d3](https://github.com/awslabs/service-workbench-on-aws/commit/24010d3a8aa771e3eedf18d3b26a261ff53e869d))
* replace aws-ee package name prefix with amzn ([#960](https://github.com/awslabs/service-workbench-on-aws/issues/960)) ([9e224ff](https://github.com/awslabs/service-workbench-on-aws/commit/9e224ff1aee34ccbdea14f330c7c840a9a39b125))
* Use correct colour for pending workspace display ([#968](https://github.com/awslabs/service-workbench-on-aws/issues/968)) ([#969](https://github.com/awslabs/service-workbench-on-aws/issues/969)) ([9f694dc](https://github.com/awslabs/service-workbench-on-aws/commit/9f694dc0072a950231ea47f76bc561838ddf72ff))
* Docs: Relevance labs changes ([#996]https://github.com/awslabs/service-workbench-on-aws/issues/996) ([8dcef6b](https://github.com/awslabs/service-workbench-on-aws/commit/8dcef6b9638ff46c07bec1793fe497caef768fa4))

### [5.1.1](https://github.com/awslabs/service-workbench-on-aws/compare/v5.1.0...v5.1.1) (2022-04-08)


### Bug Fixes

* replace aws-ee package name prefix with amzn ([#960](https://github.com/awslabs/service-workbench-on-aws/issues/960)) ([9e224ff](https://github.com/awslabs/service-workbench-on-aws/commit/9e224ff1aee34ccbdea14f330c7c840a9a39b125))

### [5.1.0](https://github.com/awslabs/service-workbench-on-aws/compare/v5.0.0...v5.1.0) (2022-03-22)

### Features

* OAuth flow: Switch to Authorization Code grant ([#947](https://github.com/awslabs/service-workbench-on-aws/issues/947)) ([9edbc12](https://github.com/awslabs/service-workbench-on-aws/commit/9edbc12bd85e0ddf4c2b271775b2fd41d9c2c236))

### Bug Fixes

* -raas-master-artifacts versioning ([#930](https://github.com/awslabs/service-workbench-on-aws/issues/930)) ([1465431](https://github.com/awslabs/service-workbench-on-aws/commit/14654313d9d472beaf497fee5b1e918aad9ff756))
* Allow users to go back and fix configuration errors ([#934](https://github.com/awslabs/service-workbench-on-aws/issues/934)) ([4f6a66d](https://github.com/awslabs/service-workbench-on-aws/commit/4f6a66dc0e6bc7f5465172045df500c825afb7a2))
* config integ test ([#950](https://github.com/awslabs/service-workbench-on-aws/issues/950)) ([2b285b7](https://github.com/awslabs/service-workbench-on-aws/commit/2b285b724cbdb3c361232b932b524dae8ba53d60))
* email TLD can be longer than 3 chars ([#928](https://github.com/awslabs/service-workbench-on-aws/issues/928)) ([eab8ec9](https://github.com/awslabs/service-workbench-on-aws/commit/eab8ec925780c5a47507cc8f93ac0faabdeb38a2))
* Exit early if jq is not installed. Fix ssm delete error ([#953](https://github.com/awslabs/service-workbench-on-aws/issues/953)) ([5c9c571](https://github.com/awslabs/service-workbench-on-aws/commit/5c9c5714947fd116ae58d39d60cb72d60914d548))
* Handle workflow-trigger-service StepFunction execution failure ([#903](https://github.com/awslabs/service-workbench-on-aws/issues/903)) ([52b24c3](https://github.com/awslabs/service-workbench-on-aws/commit/52b24c346dd3cfa91b1a385c0f8611a6ec55f678))
* no cidr form field in TRE env ([#940](https://github.com/awslabs/service-workbench-on-aws/issues/940)) ([dd2ccfd](https://github.com/awslabs/service-workbench-on-aws/commit/dd2ccfd2c606822ef0dae901ba911d560bf3df08))
* Remove non admin option for onboarding a hosting account ([#933](https://github.com/awslabs/service-workbench-on-aws/issues/933)) ([4b26589](https://github.com/awslabs/service-workbench-on-aws/commit/4b2658950b9565a7f5e0074031ce1a4625aedc7a))
* remove unnecessary file ([4d20541](https://github.com/awslabs/service-workbench-on-aws/commit/4d2054160e874a512acecb7c9c714f3a8d5cf2b6))
* Return badRequest if trying to terminate an environment that has already been terminated ([#946](https://github.com/awslabs/service-workbench-on-aws/issues/946)) ([15eb4d3](https://github.com/awslabs/service-workbench-on-aws/commit/15eb4d35320c2ba9babaa946fbecb34a9ec393b2))
* select cidr field only in non-TRE env ([#941](https://github.com/awslabs/service-workbench-on-aws/issues/941)) ([897670b](https://github.com/awslabs/service-workbench-on-aws/commit/897670b2332734ab84ffe5b537fc35f3ab17343c))
* termination failure to show fewer details ([#931](https://github.com/awslabs/service-workbench-on-aws/issues/931)) ([6700c29](https://github.com/awslabs/service-workbench-on-aws/commit/6700c2999cb1dcd2cb72b7ae40362def9650c49c))
* Throw HTTP Status 429 error when there are too many get Sagemaker Presigned URL requests ([#942](https://github.com/awslabs/service-workbench-on-aws/issues/942)) ([3dea763](https://github.com/awslabs/service-workbench-on-aws/commit/3dea7630a584051b7e2eb152f71f8423e55fc827))
* wide cidr warning and env config dep ([#935](https://github.com/awslabs/service-workbench-on-aws/issues/935)) ([95c5d95](https://github.com/awslabs/service-workbench-on-aws/commit/95c5d9579bc01c1d092487b961ebd6e6f1168eeb))

## [5.0.0](https://github.com/awslabs/service-workbench-on-aws/compare/v4.3.1...v5.0.0) (2022-02-11)

## Internal Auth deprecation
* Starting with this release, internal authentication provider in Service Workbench will remain deprecated. Logging into Service Workbench using the legacy internal authentication route will not work.
* Resources owned by `internal` users need to be deactivated or their ownership needs to be transferred to native Cognito user pool/external IdP users. Users marked with an `internal` auth provider will need to be deactivated. Please follow the detailed instructions [here](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/docs/installation_guide/upgrading/authentication.md) for a smooth upgrade experience.

### Features

* Internal auth deprecation ([#913](https://github.com/awslabs/service-workbench-on-aws/issues/913)) ([b334136](https://github.com/awslabs/service-workbench-on-aws/commit/b3341364a62b62b8f235c9eed5bb91dae6008f35))


### Bug Fixes

* add attributes for better logging ([#897](https://github.com/awslabs/service-workbench-on-aws/issues/897)) ([0a3ea5c](https://github.com/awslabs/service-workbench-on-aws/commit/0a3ea5c816cad5e5d327a53d41e6848b7d171e0a))
* Allow CICD pipeline to have cognito permission for creating root user ([#914](https://github.com/awslabs/service-workbench-on-aws/issues/914)) ([93618cb](https://github.com/awslabs/service-workbench-on-aws/commit/93618cb84476369770a848026060a2d78645d326))
* integ tests for auth change ([#915](https://github.com/awslabs/service-workbench-on-aws/issues/915)) ([86c6e19](https://github.com/awslabs/service-workbench-on-aws/commit/86c6e19d2487f7b0f1ad2fb133274eef4e2afe65))
* Reduce scope of list users API for non admin users ([#898](https://github.com/awslabs/service-workbench-on-aws/issues/898)) ([1999b26](https://github.com/awslabs/service-workbench-on-aws/commit/1999b269b8113a621a5b693802bf5d1bb406c983))
* throw less descriptive errors ([#895](https://github.com/awslabs/service-workbench-on-aws/issues/895)) ([85ae1e2](https://github.com/awslabs/service-workbench-on-aws/commit/85ae1e29974a870b133394dacf8a2f2b50ddfba7))
* user names update ([#899](https://github.com/awslabs/service-workbench-on-aws/issues/899)) ([89b9936](https://github.com/awslabs/service-workbench-on-aws/commit/89b99364d7c2c445b3b8a4119b8d3994f660896c))

### [4.3.1](https://github.com/awslabs/service-workbench-on-aws/compare/v4.3.0...v4.3.1) (2022-02-01)


### Bug Fixes

* Apply correct SWB version number by using properly formatted commit message ([6b26e0a](https://github.com/awslabs/service-workbench-on-aws/commit/6b26e0a830d47765c1721e68e5dfb591c17cfc33))

## [4.3.0](https://github.com/awslabs/service-workbench-on-aws/compare/v4.2.0...v4.3.0) (2022-01-26)


### Features

* enable flow logs for network monitoring ([#883](https://github.com/awslabs/service-workbench-on-aws/issues/883)) ([a36702b](https://github.com/awslabs/service-workbench-on-aws/commit/a36702b526a5d2c2f96e72f97e192c3a776e190b))


### Bug Fixes

* notify api returns internal error on malformed id ([#885](https://github.com/awslabs/service-workbench-on-aws/issues/885)) ([fa2550c](https://github.com/awslabs/service-workbench-on-aws/commit/fa2550c64d91612d4d19024026e58c72496c2deb))
* strengthen CSP headers for style ([#880](https://github.com/awslabs/service-workbench-on-aws/issues/880)) ([7e64ba4](https://github.com/awslabs/service-workbench-on-aws/commit/7e64ba4ef34544583df4b02568edcc2560207247))
* temp perm changes for servicecatalog ([#877](https://github.com/awslabs/service-workbench-on-aws/issues/877)) ([fbff7c0](https://github.com/awslabs/service-workbench-on-aws/commit/fbff7c0ab64e5d5a2af9e069a18f10c93a708b88))
* temp srevice catalog changes ([#878](https://github.com/awslabs/service-workbench-on-aws/issues/878)) ([e6804bf](https://github.com/awslabs/service-workbench-on-aws/commit/e6804bfceed3cf2bdcba49b353372eb39346a16b))

### [**4.2.0**](https://github.com/awslabs/service-workbench-on-aws/compare/v4.1.3...v4.2.0) (2022-01-19)
## Enhanced default authentication method
Starting with the Service Workbench 4.2.0 release, the native Amazon Cognito user pool is the default authentication method, and is reflected accordingly on the application's login page (alongside your external SAML IdP integrations, if any). 

Note: As a security enhancement, the internal authentication method used by Service Workbench (the legacy default authentication method) will soon be deprecated. 
For more information, read [Using native Amazon Cognito user pool for authentication](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/docs/configuration_guide/workflow.md)

### Customer Impact:
* You will find the default (user-customizable) configurations determining the native Amazon Cognito user pool behavior in the `main/solution/post-deployment/config/settings/.defaults.yml` file. 
* If using native Amazon Cognito user pool, users can sign up for a user account, but can not access Service Workbench until they are approved by the application admin. The user addition experience on Service Workbench for native Amazon Cognito user pool is similar to that of an external IdP.
* A new admin user would be created in Service Workbench using the `rootUserEmail` value as provided by your stage configuration. A temporary password will be available in the installation summary necessary for logging the native admin user in for the first time.
* You can still log in using the `internal` authentication method by adding the text `/?internal` to your Service Workbench URL (for eg. `https://<random_string>.cloudfront.net/?internal`).

### Important
* We suggest creating new users in native Amazon Cognito user pool (or an external IdP, if you use one) corresponding to their internal auth counterparts, and migrating resource permissions over to these new users.

### Features
* Implementation for Cognito Native Pool feature ([#858](_https://github.com/awslabs/service-workbench-on-aws/pull/858_)) ([44dd9a6](_https://github.com/awslabs/service-workbench-on-aws/commit/44dd9a6056bd7e3a0fd5f2f582726ba991da8a85_)).
### Bug Fixes
* cypress login page for Cognito enabled ([#859](_https://github.com/awslabs/service-workbench-on-aws/issues/859_)) ([726b957](_https://github.com/awslabs/service-workbench-on-aws/commit/726b9573a1d7acefa4621cf9d64a2dd8ba21cc59_))

### [4.1.3](https://github.com/awslabs/service-workbench-on-aws/compare/v4.1.2...v4.1.3) (2022-01-06)


### Bug Fixes

* Allow onboarding member account in non AppStream supported regions ([#844](https://github.com/awslabs/service-workbench-on-aws/issues/844)) ([93dc465](https://github.com/awslabs/service-workbench-on-aws/commit/93dc4658af2f6bbf9286cc1b882b7f944f365d0e))
* force securetransport traffic only for buckets with dynamic bucket policies ([#832](https://github.com/awslabs/service-workbench-on-aws/issues/832)) ([33a4346](https://github.com/awslabs/service-workbench-on-aws/commit/33a4346f34c79c1bce2ea57d445efd78b65fe705))
* unhandled workflow error ([#852](https://github.com/awslabs/service-workbench-on-aws/issues/852)) ([be127d7](https://github.com/awslabs/service-workbench-on-aws/commit/be127d7f5a8a0f9c9b5bde21d700526a50f3aa89))
* update dependabot suggested libraries ([#848](https://github.com/awslabs/service-workbench-on-aws/issues/848)) ([7b4e7c6](https://github.com/awslabs/service-workbench-on-aws/commit/7b4e7c646d288771e4510026ce08931f40a51407))
* use format instead of regex for email validN ([#849](https://github.com/awslabs/service-workbench-on-aws/issues/849)) ([640bef1](https://github.com/awslabs/service-workbench-on-aws/commit/640bef1875ab36eaf054c217097a108e3de65cc5))

### [4.1.2](https://github.com/awslabs/service-workbench-on-aws/compare/v4.1.1...v4.1.2) (2021-12-27)


### Bug Fixes

*  Terminate preexistin Rstudio instances in launch-rstudio test ([#830](https://github.com/awslabs/service-workbench-on-aws/issues/830)) ([e44e77c](https://github.com/awslabs/service-workbench-on-aws/commit/e44e77c9c57860033d500cf5582592098562550f))
* add key rotation ([#834](https://github.com/awslabs/service-workbench-on-aws/issues/834)) ([46bfa83](https://github.com/awslabs/service-workbench-on-aws/commit/46bfa830eaa3f029b4f73990771d25b867fe55f3))
* add kms permission to work with cicd pipeline ([#836](https://github.com/awslabs/service-workbench-on-aws/issues/836)) ([9ecd9ee](https://github.com/awslabs/service-workbench-on-aws/commit/9ecd9eee67518138adef302a8d4045c1653e0f08))
* elb logging on ([#843](https://github.com/awslabs/service-workbench-on-aws/issues/843)) ([163b411](https://github.com/awslabs/service-workbench-on-aws/commit/163b411530e60286835362ba35a46bf164c71ca8))
* Update EMR release label for log4j vulnerability ([#845](https://github.com/awslabs/service-workbench-on-aws/issues/845)) ([8b93e11](https://github.com/awslabs/service-workbench-on-aws/commit/8b93e11ee29c5de2272acedf718da0835db8bd15))

### [4.1.1](https://github.com/awslabs/service-workbench-on-aws/compare/v4.1.0...v4.1.1) (2021-12-13)

### Bug Fixes

- Add wait time for terminated RStudio instances in launch-rstudio-workspace test ([#826](https://github.com/awslabs/service-workbench-on-aws/issues/826)) ([ea93a8c](https://github.com/awslabs/service-workbench-on-aws/commit/ea93a8cb23c69da9fe2508bdf681e5bc4db0e870))
- allow RStudio EC2 to initialize ([#821](https://github.com/awslabs/service-workbench-on-aws/issues/821)) ([5a3590a](https://github.com/awslabs/service-workbench-on-aws/commit/5a3590a004ee5fdbc56401418df150742d28f32d))
- Change build-image CLI argument to files ([#825](https://github.com/awslabs/service-workbench-on-aws/issues/825)) ([7506895](https://github.com/awslabs/service-workbench-on-aws/commit/75068952eef2b00a33e6cb3652d7ed2039809643))
- cidr port range check ([#829](https://github.com/awslabs/service-workbench-on-aws/issues/829)) ([dbfa431](https://github.com/awslabs/service-workbench-on-aws/commit/dbfa431cf0a06f577841c3b499ea181a7ae955a5))
- delete verify linux tests from common folder ([#822](https://github.com/awslabs/service-workbench-on-aws/issues/822)) ([aff1d5c](https://github.com/awslabs/service-workbench-on-aws/commit/aff1d5c5ec4464560a6c5c9c572617112d5c079b))
- EMR launch failure because of bucket policy ([#824](https://github.com/awslabs/service-workbench-on-aws/issues/824)) ([99bb319](https://github.com/awslabs/service-workbench-on-aws/commit/99bb319a49c1b1f1584b31d708cc7b74f6f28749))
- terminate workspaces after e2e tests in non tre environment ([#820](https://github.com/awslabs/service-workbench-on-aws/issues/820)) ([bb9e457](https://github.com/awslabs/service-workbench-on-aws/commit/bb9e45701f77e192dfcbb3815c90cfeeae341105))
- Updates to RStudio Integration tests ([#818](https://github.com/awslabs/service-workbench-on-aws/issues/818)) ([eb879fe](https://github.com/awslabs/service-workbench-on-aws/commit/eb879fe0d57e0874dd75bfc1d0550a1bf407f791))

### Documentation

- rstudio doc updates ([#827](https://github.com/awslabs/service-workbench-on-aws/pull/827)) ([772617f](https://github.com/awslabs/service-workbench-on-aws/commit/772617f1888a25fd91b884121d98f23612a28f48))

## [4.1.0](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.2...v4.1.0) (2021-11-19)

### Features

- Implementation for RstudioV2 (backed by ALB) feature ([#807](https://github.com/awslabs/service-workbench-on-aws/pull/807)) ([ed2e7dc](https://github.com/awslabs/service-workbench-on-aws/commit/ed2e7dc60a35a12a8f14f55964ade66a88e38298)). In this release, RStudio ALB workspace type is provided with the following new features:

  - Compatibility with TRE (AppStream and Egress) features. See [Prepare your account for AppStream](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/docs/deployment/post_deployment/aws_accounts.md#prepare-your-account-for-appstream).
  - New input parameter **ACMSSLCertARN** has been introduced in the RStudio workspace type template. The template is created by the scripts provided in AWS partner’s repository. **ACMSSLCertARN** corresponds to the certificates of the custom domain present in the hosting account.
  - The **AmiID** parameter value can be retrieved by creating a new AMI using the scripts provided in AWS [partner’s repository](https://github.com/RLOpenCatalyst/Service_Workbench_Templates).
  - A common [Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) (ALB) has been provided in the hosting account. See [Application load balancing for RStudio ALB workspace](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/docs/deployment/post_deployment/aws_accounts.md#application-load-balancing-for-rstudio-alb-workspace).
  - Allows you to leverage the automatic certificate refresh feature from [AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html) (ACM). As a result, you need not manually import the certificates into your main account ACM or hosting account ACM.
  - Note: With this release, the support for legacy RStudio workspace type has been deprecated. Please terminate legacy RStudio environment instances, if you have any.

- Add pending filter tab under AWS Accounts page ([#786](https://github.com/awslabs/service-workbench-on-aws/issues/786)) ([831da13](https://github.com/awslabs/service-workbench-on-aws/commit/831da13e4df32d3da67101f9065c109351f9b38c))
- Add user's email to JSON response of egress request ([#771](https://github.com/awslabs/service-workbench-on-aws/issues/771)) ([e3c6c22](https://github.com/awslabs/service-workbench-on-aws/commit/e3c6c225f45d482b7a6b25e8fea0437a90ae0828))

### Bug Fixes

- Add WorkflowDraftId validation on backend ([#777](https://github.com/awslabs/service-workbench-on-aws/issues/777)) ([f240d81](https://github.com/awslabs/service-workbench-on-aws/commit/f240d813906d48fe135360f767de5df62f138d99))
- default hosted zone in infra ([#794](https://github.com/awslabs/service-workbench-on-aws/issues/794)) ([0967129](https://github.com/awslabs/service-workbench-on-aws/commit/096712990b12692dcb725961dab94494bfc2d58e))
- default image builder update ([#781](https://github.com/awslabs/service-workbench-on-aws/issues/781)) ([6398830](https://github.com/awslabs/service-workbench-on-aws/commit/639883074d634ba5533358cf42d841d7984609a5))
- enable versioning ([#780](https://github.com/awslabs/service-workbench-on-aws/issues/780)) ([380a938](https://github.com/awslabs/service-workbench-on-aws/commit/380a9382a3d76872212723a06c3e21455c4467f3))
- hsts header ([#790](https://github.com/awslabs/service-workbench-on-aws/issues/790)) ([66f79f2](https://github.com/awslabs/service-workbench-on-aws/commit/66f79f2264f2850a79311dea647718354cb7bde3))
- more secure traffic policy ([#782](https://github.com/awslabs/service-workbench-on-aws/issues/782)) ([9264b6a](https://github.com/awslabs/service-workbench-on-aws/commit/9264b6a7ea78fdfb0cc9e943c967d7034a70b223))
- moving advanced integ tests in non-TRE folder ([#772](https://github.com/awslabs/service-workbench-on-aws/issues/772)) ([b10f4b0](https://github.com/awslabs/service-workbench-on-aws/commit/b10f4b0bb8253f68a3e434b5d2e3c22655eaa153))
- prevent duplicate hosted zone creation ([#789](https://github.com/awslabs/service-workbench-on-aws/issues/789)) ([ac72b90](https://github.com/awslabs/service-workbench-on-aws/commit/ac72b9000ccdf06ac17f542ada80f6745c58246a))
- remove custom domain condition infra cfn ([#817](https://github.com/awslabs/service-workbench-on-aws/issues/817)) ([33b53da](https://github.com/awslabs/service-workbench-on-aws/commit/33b53da9a2793b5823bc979301468500d4f01289))
- run TRE tests for develop merge ([#802](https://github.com/awslabs/service-workbench-on-aws/issues/802)) ([c6e04ca](https://github.com/awslabs/service-workbench-on-aws/commit/c6e04ca2f41becd03865ca9fd0bc59afff8f288c))
- sc portfolio deletion correction ([#779](https://github.com/awslabs/service-workbench-on-aws/issues/779)) ([6e4d67b](https://github.com/awslabs/service-workbench-on-aws/commit/6e4d67ba19b9dd423aeb0f04b8d5c8350c3c8726))
- script permissions ([#793](https://github.com/awslabs/service-workbench-on-aws/issues/793)) ([5b404f0](https://github.com/awslabs/service-workbench-on-aws/commit/5b404f002ebe877179c80ec904201cdc2acf909b))
- update GH action to use custom domain ([#791](https://github.com/awslabs/service-workbench-on-aws/issues/791)) ([b2fdfcb](https://github.com/awslabs/service-workbench-on-aws/commit/b2fdfcbdee10a00f9d0f1de485798d8e3694974e))

### [4.0.2](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.1...v4.0.2) (2021-10-19)

### Bug Fixes

- add coverage for undef config case ([#761](https://github.com/awslabs/service-workbench-on-aws/issues/761)) ([a3f3f09](https://github.com/awslabs/service-workbench-on-aws/commit/a3f3f09fef9dd70f3b97f9abc88e2c88c28d8181))
- AppDeployer needs perms to create new env ([#762](https://github.com/awslabs/service-workbench-on-aws/issues/762)) ([fe75f8b](https://github.com/awslabs/service-workbench-on-aws/commit/fe75f8be3580bb094ff4042f10ed1159f8ef3346))
- display unavailable after config deletion ([#760](https://github.com/awslabs/service-workbench-on-aws/issues/760)) ([9c1daa4](https://github.com/awslabs/service-workbench-on-aws/commit/9c1daa489cee438bed849cf425ce7f3a6dd258f9))

### [4.0.1](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.0...v4.0.1) (2021-10-15)

Notes: We recommend to apply this patch as soon as possible if you use [CICD](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/cicd/cicd-source/README.md) component

### Bug Fixes

- remove test target from infrastructure tests as it is reserved for unit tests ([#756](https://github.com/awslabs/service-workbench-on-aws/issues/756)) ([4adb965](https://github.com/awslabs/service-workbench-on-aws/commit/4adb965d6b74d8354eea4b036aa3510749b067fd))

## [4.0.0](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.0...v3.5.0) (2021-10-14)

### Features

- Egress, Secured Workspaces (AppStream) and Account update wizard ([#750](https://github.com/awslabs/service-workbench-on-aws/issues/750)) ([b990924](https://github.com/awslabs/service-workbench-on-aws/commit/b99092458c7ee11f9b7540f7d1bbf898dd90744f))

Service Workbench is incrementing a major release version to bring attention to three new features.

#### 1. Member account onboarding improvement

The Service Workbench member account onboarding process is changed to be more in line with the Bring Your Own Bucket (BYOB) process. The general intent is that the process to onboard an account in support of hosting data should be the same as onboarding an account in support of hosting researcher workspace compute. Twelve points of context switching and manual data entry have been eliminated with the new process.

This change applies to all updated installations, and can be applied to those installations that have already onboarded member accounts.

To learn more about the new process, refer to the updated [instructions](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/Service_Workbench_Post_Deployment_Guide.pdf) in the Service Workbench Post Deployment guide.

**Important Notes:**

<<<<<<< HEAD

- If you have already onboarded a member account for your Service Workbench installation, and this account has active or stopped workspaces, the safest course would be to terminate all workspaces prior to the update. We did test a scenario with active and stopped workspaces and observed no impact during testing, but because this update is a major release, we recommend the safest course.
- # Any member accounts that were onboarded prior to this update will need to be updated through the Service Workbench user interface, and you will be prompted to do so when visiting the new “Accounts” page in Service Workbench. This update is necessary because there is a new capability that will check to see if the member and main account code versions are in sync, and provide a visual indicator if not, allowing you a clear indication of update.

* If you have already onboarded a member account for your Service Workbench installation, and this account has active or stopped workspaces, the safest course would be to terminate all workspaces prior to the update. We did test a scenario with active and stopped workspaces and observed no impact during testing, but because this update is a major release, we recommend the safest course.
* After updating the member account, delete the old workspace types and import the new workspace types. This is needed because the old workspace types may not work correctly with Service Workbench 4.0.0.
* Any member accounts that were onboarded prior to this update will need to be updated through the Service Workbench user interface, and you will be prompted to do so when visiting the new “Accounts” page in Service Workbench. This update is necessary because there is a new capability that will check to see if the member and main account code versions are in sync, and provide a visual indicator if not, allowing you a clear indication of update.

> > > > > > > ea93a8cb23c69da9fe2508bdf681e5bc4db0e870

#### 2. Enabling secure desktop

Introduction of [AppStream 2.0](https://aws.amazon.com/appstream2/) as an access point for Service Workbench workspaces. With this enabled, researchers will not be able to egress the data from their Service Workbench workspaces to their client machine, and Service Workbench workspaces will not have access to the internet.

Core networking changes within the member account will move researcher workspaces to the private subnets, and the method of connecting to a researcher workspace changes. Restricting access by public IP is no longer available, and the layer of security per workspace that replaces IP restriction is outlined in connection instructions in the Service Workbench workspace UI.

This feature is disabled by default upon install. To enable this feature, change the feature flag `isAppStreamEnabled` in the [configuration file](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/config/settings/.defaults.yml#L204) to `true`.

**Important Notes:**

- _Once this feature is enabled for a Service Workbench installation, it cannot be disabled without deleting the installation and reinstalling._ This is because there are core networking changes for workspaces that cannot be reverted.
- If you have an existing installation without the feature flag enabled, and want to activate this feature flag, terminate all workspaces prior to activating the flag.
- AppStream service use does incur additional cost and we recommend you review the cost impact prior to configuring your AppStream fleet: https://aws.amazon.com/appstream2/pricing/
- Because the Service Workbench workspaces do not have internet connectivity, [VPC endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html) are introduced for all AWS services that the workspaces use (such as S3, EC2, and AppStream).
- Significant updates to the post deployment configuration instructions when this feature is enabled are outlined [here](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/Service_Workbench_Post_Deployment_Guide.pdf)

#### 3. Enabling secure egress

As a compliment to the Secure Desktop functionality, this feature provides a mount point per workspace (that is only accessible from that workspace) for a researcher to stage data that they wish to take out of the Service Workbench installation. Once the data is put to this location (called the Egress Store), the researcher can choose the _Submit Egress Request_ button and a message is generated to a SNS Topic (https://aws.amazon.com/sns/) containing the metadata for their egress request.

Like the Secure Desktop feature, this feature is also disabled by default upon install. To enable this feature, you must change the feature flag `enableEgressStore` in the [configuration file](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/config/settings/.defaults.yml#L184) to `true`. Note that this feature flag is independent from the Secure Desktop feature flag, but if it is activated by itself, there is nothing preventing the researcher from copying data to their local client (thus outside the egress store).

**Important Notes:**

- Currently, the message goes to the SNS topic - but there is not subscriber added to the topic. It is your responsibility to subscribe to the topic, and to act on the Egress Store data source with elevated permissions through the AWS Management Console.
- When this feature is enabled, the Bring Your Own Buckets (BYOB) data sources are only allowed to be read only. This is because a BYOB data source can live in a different AWS account (unlike MyStudy and Organizational Study that live in the main Service Workbench main account). Allowing write to a BYOB data source would be uncontrolled egress.

## [3.5.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.4.0...v3.5.0) (2021-10-14)

### Features

- dynamic version number from CHANGELOG and automation of Beta versioning ([#716](https://github.com/awslabs/service-workbench-on-aws/issues/716)) ([5887170](https://github.com/awslabs/service-workbench-on-aws/commit/5887170b4c4af548ea39f2ce7b9c856bc7e9f887))

### Bug Fixes

- build ami version bug ([#738](https://github.com/awslabs/service-workbench-on-aws/issues/738)) ([a39b3b4](https://github.com/awslabs/service-workbench-on-aws/commit/a39b3b4b945254f71b27fe3bdcdda8f819f32069))
- bypass develop protection when adding beta ([#725](https://github.com/awslabs/service-workbench-on-aws/issues/725)) ([fe4c0ff](https://github.com/awslabs/service-workbench-on-aws/commit/fe4c0ffa774e7e418928af11a4bb24e57f55786a))
- downgrade node-ssh version to fix integ tests ([#744](https://github.com/awslabs/service-workbench-on-aws/issues/744)) ([f5ce251](https://github.com/awslabs/service-workbench-on-aws/commit/f5ce251ea110ae73ba34aabe3b6c6032df9901a2))
- integ test setup flakiness fix ([#727](https://github.com/awslabs/service-workbench-on-aws/issues/727)) ([65ea43d](https://github.com/awslabs/service-workbench-on-aws/commit/65ea43daa7430e3bffd60f1563194a035413d765))
- namespace code works with configs with no namespace param ([#717](https://github.com/awslabs/service-workbench-on-aws/issues/717)) ([72c9fe3](https://github.com/awslabs/service-workbench-on-aws/commit/72c9fe39b6c60713546b4d7aae20ae1caca7a526))
- Update libcurl-devel package for RStudio to correct version ([#726](https://github.com/awslabs/service-workbench-on-aws/issues/726)) ([04bb82c](https://github.com/awslabs/service-workbench-on-aws/commit/04bb82c3e3303447e46abc97b306aa31632cc8d6))
- version number before backend deployment ([#724](https://github.com/awslabs/service-workbench-on-aws/issues/724)) ([6d545dd](https://github.com/awslabs/service-workbench-on-aws/commit/6d545dd1d709359fa8f8907e334eef3a65acc0d4))

## [3.4.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.3.1...v3.4.0) (2021-09-16)

### Features

- display Configuration Name and Instance Type on Workspace details card ([#669](https://github.com/awslabs/service-workbench-on-aws/issues/669)) ([f0fa819](https://github.com/awslabs/service-workbench-on-aws/commit/f0fa8191a22c33c9b669d56764cac676e6a1aaaa))
- Pre-populate variable values in input section of new workspace configuration ([#680](https://github.com/awslabs/service-workbench-on-aws/issues/680)) ([8ce51b2](https://github.com/awslabs/service-workbench-on-aws/commit/8ce51b200148108ac869e1a8ae26286b65c94cc1))

### Bug Fixes

- add label to stop timeout during e2e test ([#688](https://github.com/awslabs/service-workbench-on-aws/issues/688)) ([ff0b4cc](https://github.com/awslabs/service-workbench-on-aws/commit/ff0b4ccbb8349df7262469411bf23729be174621))
- end2end test terminated existing ws ([#685](https://github.com/awslabs/service-workbench-on-aws/issues/685)) ([9c74ac7](https://github.com/awslabs/service-workbench-on-aws/commit/9c74ac794aa75b4292291b9fa2f3768bed76eb81))
- github cypress setup ([#686](https://github.com/awslabs/service-workbench-on-aws/issues/686)) ([23f6d03](https://github.com/awslabs/service-workbench-on-aws/commit/23f6d0366f1b82eb569fe9fc363f47248d6e9011))
- go bug during deployment is handled ([#641](https://github.com/awslabs/service-workbench-on-aws/issues/641)) ([4c21a30](https://github.com/awslabs/service-workbench-on-aws/commit/4c21a305943f8c3b8436a0f4f534594ca5425ad4))
- no sagemaker autostop or EC2 stop lag ([#703](https://github.com/awslabs/service-workbench-on-aws/issues/703)) ([8cb199b](https://github.com/awslabs/service-workbench-on-aws/commit/8cb199b8093f5e799d2d87c228930a4929ebebb7))
- properly handle very long error messages on env update ([#705](https://github.com/awslabs/service-workbench-on-aws/issues/705)) ([d920abd](https://github.com/awslabs/service-workbench-on-aws/commit/d920abd8666eaf905810680aec24428e8ce46124))
- reset ForceLogout component upon relogin ([#640](https://github.com/awslabs/service-workbench-on-aws/issues/640)) ([5c2aaee](https://github.com/awslabs/service-workbench-on-aws/commit/5c2aaee79428c3d4e2bceb115b77a6eb477a6add))
- static namespace bug fix ([#615](https://github.com/awslabs/service-workbench-on-aws/issues/615)) ([bacb469](https://github.com/awslabs/service-workbench-on-aws/commit/bacb469d048601cc73f10a3d7145197fbeae8c62))
- sync UI and API func ([#709](https://github.com/awslabs/service-workbench-on-aws/issues/709)) ([a188b3c](https://github.com/awslabs/service-workbench-on-aws/commit/a188b3c918bea677acf5115cec006f50782e83bb))
- update int test readme to include adv test info ([#634](https://github.com/awslabs/service-workbench-on-aws/issues/634)) ([5453f5e](https://github.com/awslabs/service-workbench-on-aws/commit/5453f5e133672bc137bb61d5c3b8bf097152a851))

### Documentation

- New user guide PDF ([#704](https://github.com/awslabs/service-workbench-on-aws/pull/704)) ([d375785](https://github.com/awslabs/service-workbench-on-aws/commit/c560b95574d562dc8fc1c43a8b73bf2c70c3dd9a))

### [3.3.1](https://github.com/awslabs/service-workbench-on-aws/compare/v3.3.0...v3.3.1) (2021-07-26)

### Bug Fixes

- application version number ([#573](https://github.com/awslabs/service-workbench-on-aws/issues/573)) ([fada154](https://github.com/awslabs/service-workbench-on-aws/commit/fada154f0cee6d38722f30446b71ebbde32cb6fb))
- Clear timer in ForceLogout.test.js to allow tests to end ([#570](https://github.com/awslabs/service-workbench-on-aws/issues/570)) ([4871e0f](https://github.com/awslabs/service-workbench-on-aws/commit/4871e0f885a5051b4542c37f72abb9d67f281dce))
- Remove delete user feature from UI and handle study permissions which have stale users ([#595](https://github.com/awslabs/service-workbench-on-aws/issues/595)) ([8be3f90](https://github.com/awslabs/service-workbench-on-aws/commit/8be3f902eea97f53c70373e3e19fb359005ad7f4))

### Chore

- **deps:** bump all dependencies ([#556](https://github.com/awslabs/service-workbench-on-aws/issues/556)) ([46e26af](https://github.com/awslabs/service-workbench-on-aws/commit/46e26af8f7cb34daeb134b7cd732775ad4e61ec4))

### Documentation

- Added details found needed while onboarding ([#593](https://github.com/awslabs/service-workbench-on-aws/issues/593)) ([d375785](https://github.com/awslabs/service-workbench-on-aws/commit/d375785fe5b42f70a2e371b985fd2d5a0dd734bd))
- IDP configuration guide ([#569](https://github.com/awslabs/service-workbench-on-aws/issues/569)) ([406c656](https://github.com/awslabs/service-workbench-on-aws/commit/406c656948993474a9c60889e4f8548fa8b0c108))

## [3.3.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.2.0...v3.3.0) (2021-06-25)

### Documentation

- Service Workbench installation guide ([#545](https://github.com/awslabs/service-workbench-on-aws/issues/545)) ([2be27d1](https://github.com/awslabs/service-workbench-on-aws/commit/2be27d16da5a4c0405648b220a548415eed47ef7))

## [3.2.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.1.0...v3.2.0) (2021-06-11)

### Features

- Add warning that internal authentication shouldn't be used in production ([#506](https://github.com/awslabs/service-workbench-on-aws/issues/506)) ([1586278](https://github.com/awslabs/service-workbench-on-aws/commit/15862785fb0ade825c251902bd13dea948833c19))
- Encrypt s3 buckets for EMR log bucket and CICD Artifact bucket ([#508](https://github.com/awslabs/service-workbench-on-aws/issues/508)) ([e86fd06](https://github.com/awslabs/service-workbench-on-aws/commit/e86fd0668aa6971e09491ab090586ce825f51069))
- study permissions only shown to Study Admin ([#501](https://github.com/awslabs/service-workbench-on-aws/issues/501)) ([f3eaae8](https://github.com/awslabs/service-workbench-on-aws/commit/f3eaae802c838b92fe95deea3dd4a3ac23c89d3b))

### Bug Fixes

- add termination status for non-found workspaces ([#502](https://github.com/awslabs/service-workbench-on-aws/issues/502)) ([8c30378](https://github.com/awslabs/service-workbench-on-aws/commit/8c30378dd25c02abd3bb3a250a68eccee3b7bca3))
- adds 'stopped' filter for workspaces ([960b592](https://github.com/awslabs/service-workbench-on-aws/commit/960b592341b186f09da12307cca138fd0b4fde25))
- Allow sagemaker to have the proper IAM permission to autostop itself ([#515](https://github.com/awslabs/service-workbench-on-aws/issues/515)) ([32007ed](https://github.com/awslabs/service-workbench-on-aws/commit/32007edb95ee411a0cc4a302c0af247e54d438a0))
- Corrected Spark defaults to fix read/write functionality from Spark ([#526](https://github.com/awslabs/service-workbench-on-aws/issues/526)) ([f96e1bd](https://github.com/awslabs/service-workbench-on-aws/commit/f96e1bde4f535c79b81490888436c9dfb49045c9))
- Do not allow users to change root password ([#503](https://github.com/awslabs/service-workbench-on-aws/issues/503)) ([a436f73](https://github.com/awslabs/service-workbench-on-aws/commit/a436f73bcbf8c9c23bed7ebaa11837ca13628ccb))
- moved notification boxes to avoid blocking the top ribbon. ([#483](https://github.com/awslabs/service-workbench-on-aws/issues/483)) ([5a226d7](https://github.com/awslabs/service-workbench-on-aws/commit/5a226d7a46ccae2d9f741dbeffe24d78e8dad252))
- react compilation error ([#500](https://github.com/awslabs/service-workbench-on-aws/issues/500)) ([547f2ad](https://github.com/awslabs/service-workbench-on-aws/commit/547f2ad9e1d3abfb61dfecc73268da541f243aad))
- Redirect non admin users to "/" if they try to access "/users" ([#489](https://github.com/awslabs/service-workbench-on-aws/issues/489)) ([ee3a58e](https://github.com/awslabs/service-workbench-on-aws/commit/ee3a58e864f2f620358a34063afcbb02adde687c))

## [3.1.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.0.0...v3.1.0) (2021-05-10)

### Features

- Allow uploading a folder to My Studies ([#475](https://github.com/awslabs/service-workbench-on-aws/issues/475)) ([cb17d4b](https://github.com/awslabs/service-workbench-on-aws/commit/cb17d4be8c0fdaaee7384229629e4bc7ec7d95a1))
- Run coverage for merge commit ([#458](https://github.com/awslabs/service-workbench-on-aws/issues/458)) ([03afe0e](https://github.com/awslabs/service-workbench-on-aws/commit/03afe0e1387b30dfc50ffab48b9982103048c585))
- Test coverage ([#456](https://github.com/awslabs/service-workbench-on-aws/issues/456)) ([252b504](https://github.com/awslabs/service-workbench-on-aws/commit/252b5049400c1d3fcb2ceb4720f64210bf0d5359))

### Bug Fixes

- Fix BYOB app role to only modify FS roles ([#454](https://github.com/awslabs/service-workbench-on-aws/issues/454)) ([35f6cce](https://github.com/awslabs/service-workbench-on-aws/commit/35f6cce3ccc301921ead742240c15c1a7e332f0c))
- free-form strings for workspace configs ([#479](https://github.com/awslabs/service-workbench-on-aws/issues/479)) ([fca73f4](https://github.com/awslabs/service-workbench-on-aws/commit/fca73f4dbaf509f06ce55b6b0c87c66e31ed8a88))
- properly handle SC products with no active versions ([#468](https://github.com/awslabs/service-workbench-on-aws/issues/468)) ([3c561f4](https://github.com/awslabs/service-workbench-on-aws/commit/3c561f4850faffe3ccc6fd0ffcc5b7065f53f3c6))
- Update workspace name reg exp and workspace config tags reg exp ([#452](https://github.com/awslabs/service-workbench-on-aws/issues/452)) ([f9b7d62](https://github.com/awslabs/service-workbench-on-aws/commit/f9b7d628a08b337eaa0a9c8b71bb6226ff0f7b34))

## [3.0.0] - 2021-04-19

### Added

- refactor: restricting AppDeployer permissions
- refactor: Remove permission boundary condition on launch constraint role
- refactor: restrict sc roles

**Permissions boundaries are being added to the several important IAM roles used by Service Workbench as a security best practice.**

**Customer Impact:** Below outlines the actions required for you to successfully adopt this security enhancement. The first two items are applicable to all customers. If you have created custom workspace types, then all three items below are applicable.

1. After running the update, onboard all hosting accounts once again to benefit from the enhanced security, and test the application.
   **Note:** The attached pdf contains steps for onboarding hosting accounts, contact your Service Workbench Administrator if you have not performed these steps before.

2. After running the update, import and use the newly available Service Catalog product versions for workspace types (latest version numbers) to benefit from the enhanced security.

3. **ONLY Customers that have created custom workspace types:** It is possible that the permissions boundaries would prevent actions that were formerly allowed. You should plan to validate your custom workspace types after the update. Issues should be addressed by modifying the custom workspaces to work within the permissions granted, or modify the permissions boundary for your installation (this would require a change to Service Workbench code (specifically the IAM policies that are attached as the permissions boundary) for your install).
   Note: Any existing custom or non-custom workspaces types (for example, EC2 Linux/Windows, EMR, SageMaker, R Studio) are not impacted by this upgrade.

## [2.2.0] - 2021-04-12

### Added

- feat: Display SWB Version in UI's Top Bar
- fix: Fix cost dashboard bugs

## [2.1.5] - 2021-04-08

### Added

- fix: Ensure sdk retry logic is enabled in prod
- docs: Readme updated
- fix: assume role on added member account

## [2.1.4] - 2021-04-06

### Added

- fix: managing pnpm version for nodejs compatibility

## [2.1.3] - 2021-04-06

### Added

- fix: adding required AppDeployer permissions
- chore: package dependency updates
- fix: added X-ray support and fix CWL IAM permissions

If you have been using CI/CD pipeline, please redeploy the pipeline stack to incorporate this fix by following the steps listed on the `main/cicd/README.md` file.

## [2.1.2] - 2021-04-01

### Added

- fix: managing AppDeployer role permission boundary
- fix: CW log resources corrected in backend CFN template
- refactor: restrict ApiHandler role permissions
- refactor: restrict WorkflowLoopRunner role permissions
- refactor: restrict CrossAcctExec role permissions
- chore: team email removed from feedback section in readme
- chore: updates to npm dependencies

If you have been using CI/CD pipeline, please redeploy the pipeline stack to incorporate this fix by following the steps listed on the `main/cicd/README.md` file.

## [2.1.1] - 2021-03-19

### Added

- chore: Enable SSE-S3 when registering buckets in BYOB
- refactor: restrict data source reachability Lambda role
- fix: Add 'reachable' and 'error' status to reachability check schema
- fix: added region parameter reference to elasticmapreduce bucket references

## [2.1.0] - 2021-03-12

### Added

- fix: Upgraded react-dev-utils yarn dependency version
- feat: Added Bring Your Own Bucket(BYOB) functionality
- feat: Added integration testing for all APIs
- feat: Added OpenAPI documentation
- feat: Removed unused APIs- listWorkflowInstancesByStatus and createAuthenticationProviderConfig

## [2.0.3] - 2021-03-12

### Added

- chore(deps): bump websocket-extensions from 0.1.3 to 0.1.4
- test: fix flaky integ tests
- fix: emr workspace image. Lock jupyterlab to version 2.2.6
- test: Implemented integration tests for service catalog workspaces
- feat: verbose integ test log

## [2.0.2] - 2021-03-03

### Added

- fix: SageMaker environment status update
- fix: Validate Open Data ARNs
- test: Integration test components and framework
- chore: Dependency version bump

## [2.0.1] - 2021-02-08

### Added

- fix: Added usernameInIdp property to update user schema
- fix: Made external researcher used UserOnboarding template less permissive
- fix: labeler yml syntax
- chore: add PR size labeler

We recommend to apply this patch as soon as possible

## [2.0.0] - 2021-01-29

### Added

- feat: Adding ability to manage CIDR blocks of workspace's configured security group

Note:

1. This feature has added permissions to the onboard-account template and requires re-onboarding existing member accounts. Please contact your system administrator for the same.
2. For RStudio instances, please allow 2-5 minutes for CIDR changes to take effect.
3. For SageMaker instances, currently application admins and workspace owners have ability to access the SageMaker platform directly, irrespective of CIDR inclusion.

- feat: Remove APIs for built-in workspaces

## [1.4.7] - 2021-01-28

### Added

- fix: Fix a bug on the update user API

We recommend to apply this patch as soon as possible

## [1.4.6] - 2021-01-15

### Added

- fix: Add tables back to cloudformation and don't authorize API Keys

We recommend to apply this patch as soon as possible

## [1.4.5] - 2021-01-14

### Added

- fix: remove API Keys functionality

We recommend to apply this patch as soon as possible

## [1.4.4] - 2021-01-13

### Added

- fix: open data scraper bugfix
- docs: improvements to deployment documentation
- fix: Upload Files button disappears for R/W users
- feat: install R3.6 and system packages required for dev
- fix: file not found error in download-env-config script
- test: Add github workflow for e2etest run
- feat: modify filter criteria for Open Data
- docs: delete dead links
- fix: changed RStudio server CSP headers to allow uploads from same-origin

## [1.4.3] - 2020-11-24

### Added

- feat: Support Read/Write Study mounts for EC2 Windows

## [1.4.2] - 2020-11-23

### Added

- fix: Fix a bug on the update study API

We recommend to apply this patch as soon as possible

## [1.4.1] - 2020-11-18

### Added

- fix: Handling policy names for windows envs
- fix: Fix a bug on the create study API

We recommend to apply this patch as soon as possible

## [1.4.0] - 2020-11-13

### Added

- feat: Study Read/Write and Permission propagation (Goofys)
- feat: Read/Only study mounts on AWS Service Catalog based EC2 Windows workspaces

## [1.3.2] - 2020-10-23

### Added

- fix: Adding dependencies for Dynamo table creation to prevent install crash
- fix: Query string parameters were getting duplicated in the url
- feat: Pre-install git on RStudio workspaces

## [1.3.1] - 2020-10-20

### Added

- chore: Create better env delete logs
- fix: Apply version name to products out of the box
- fix: changing rstudio check-idle logic
- fix: Cognito user pool domain name clashing issue
- fix(End to End test): When creating a workspace, select project by class item
- fix: Sagemaker instances respect CIDR blocks that are provided to the instance
  - For existing service workbench deployments you will need to import Sagemaker as a workspace type again to mitigate the risk of exposing workspaces to all IPs
  - Existing Sagemaker workspaces will continue to have this issue

## [1.3.0] - 2020-10-09

### Added

- feat: manual stop and start functionality for EC2 Linux, EC2 Windows, RStudio and Sagemaker workspaces
- feat: auto stop functionality for SageMaker and RStudio workspaces
- bugfix: outdated lock file
- doc: update deployment and post-deployment documentation

## [1.2.0] - 2020-09-29

### Added

- feat: user id change. We will be using a uid going forward as a user identity
- feat(backend): Also allow UPLOAD access for users with write access
- bugfix: rethrow unknown exceptions
- bugfix: rstudio connection fix, removing appsteam
- bugfix: metaconnection check for rstudio

## [1.1.0] - 2020-09-11

### Added

- Add budget integration - Admin users can set up budget and alert notifications for AWS member accounts on-boarded with Service Workbench
- Adding RStudio Service Catalog product - Users can now use RStudio in Service Catalog

## [1.0.1] - 2020-08-31

### Added

- Bug fix for Service Catalog product artifact creation (occurs when CfN template is edited in-place)

## [1.0.0] - 2020-08-28

### Added

- Initial launch! :rocket:
