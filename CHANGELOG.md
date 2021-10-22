# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [4.0.2](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.1...v4.0.2) (2021-10-19)


### Bug Fixes

* add coverage for undef config case ([#761](https://github.com/awslabs/service-workbench-on-aws/issues/761)) ([a3f3f09](https://github.com/awslabs/service-workbench-on-aws/commit/a3f3f09fef9dd70f3b97f9abc88e2c88c28d8181))
* AppDeployer needs perms to create new env ([#762](https://github.com/awslabs/service-workbench-on-aws/issues/762)) ([fe75f8b](https://github.com/awslabs/service-workbench-on-aws/commit/fe75f8be3580bb094ff4042f10ed1159f8ef3346))
* display unavailable after config deletion ([#760](https://github.com/awslabs/service-workbench-on-aws/issues/760)) ([9c1daa4](https://github.com/awslabs/service-workbench-on-aws/commit/9c1daa489cee438bed849cf425ce7f3a6dd258f9))

### [4.0.1](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.0...v4.0.1) (2021-10-15)

Notes: We recommend to apply this patch as soon as possible if you use [CICD](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/cicd/cicd-source/README.md) component

### Bug Fixes

* remove test target from infrastructure tests as it is reserved for unit tests ([#756](https://github.com/awslabs/service-workbench-on-aws/issues/756)) ([4adb965](https://github.com/awslabs/service-workbench-on-aws/commit/4adb965d6b74d8354eea4b036aa3510749b067fd))

## [4.0.0](https://github.com/awslabs/service-workbench-on-aws/compare/v4.0.0...v3.5.0) (2021-10-14)

### Features

* Egress, Secured Workspaces (AppStream) and Account update wizard ([#750](https://github.com/awslabs/service-workbench-on-aws/issues/750)) ([b990924](https://github.com/awslabs/service-workbench-on-aws/commit/b99092458c7ee11f9b7540f7d1bbf898dd90744f)) 

Service Workbench is incrementing a major release version to bring attention to three new features.

#### 1. Member account onboarding improvement

The Service Workbench member account onboarding process is changed to be more in line with the Bring Your Own Bucket (BYOB) process. The general intent is that the process to onboard an account in support of hosting data should be the same as onboarding an account in support of hosting researcher workspace compute. Twelve points of context switching and manual data entry have been eliminated with the new process.

This change applies to all updated installations, and can be applied to those installations that have already onboarded member accounts.

To learn more about the new process, refer to the updated [instructions](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/Service_Workbench_Post_Deployment_Guide.pdf) in the Service Workbench Post Deployment guide.

**Important Notes:**

* If you have already onboarded a member account for your Service Workbench installation, and this account has active or stopped workspaces, the safest course would be to terminate all workspaces prior to the update. We did test a scenario with active and stopped workspaces and observed no impact during testing, but because this update is a major release, we recommend the safest course.
* Any member accounts that were onboarded prior to this update will need to be updated through the Service Workbench user interface, and you will be prompted to do so when visiting the new “Accounts” page in Service Workbench. This update is necessary because there is a new capability that will check to see if the member and main account code versions are in sync, and provide a visual indicator if not, allowing you a clear indication of update.


#### 2. Enabling secure desktop

Introduction of [AppStream 2.0](https://aws.amazon.com/appstream2/) as an access point for Service Workbench workspaces. With this enabled, researchers will not be able to egress the data from their Service Workbench workspaces to their client machine, and Service Workbench workspaces will not have access to the internet.

Core networking changes within the member account will move researcher workspaces to the private subnets, and the method of connecting to a researcher workspace changes. Restricting access by public IP is no longer available, and the layer of security per workspace that replaces IP restriction is outlined in connection instructions in the Service Workbench workspace UI.  

This feature is disabled by default upon install. To enable this feature, change the feature flag `isAppStreamEnabled` in the [configuration file](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/config/settings/.defaults.yml#L204) to `true`.

**Important Notes:**

* *Once this feature is enabled for a Service Workbench installation, it cannot be disabled without deleting the installation and reinstalling.* This is because there are core networking changes for workspaces that cannot be reverted.
* If you have an existing installation without the feature flag enabled, and want to activate this feature flag, terminate all workspaces prior to activating the flag.
* AppStream service use does incur additional cost and we recommend you review the cost impact prior to configuring your AppStream fleet: https://aws.amazon.com/appstream2/pricing/
* Because the Service Workbench workspaces do not have internet connectivity, [VPC endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html) are introduced for all AWS services that the workspaces use (such as S3, EC2, and AppStream).
* Significant updates to the post deployment configuration instructions when this feature is enabled are outlined [here](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/Service_Workbench_Post_Deployment_Guide.pdf) 

#### 3. Enabling secure egress

As a compliment to the Secure Desktop functionality, this feature provides a mount point per workspace (that is only accessible from that workspace) for a researcher to stage data that they wish to take out of the Service Workbench installation. Once the data is put to this location (called the Egress Store), the researcher can choose the *Submit Egress Request* button and a message is generated to a SNS Topic (https://aws.amazon.com/sns/) containing the metadata for their egress request.

Like the Secure Desktop feature, this feature is also disabled by default upon install. To enable this feature, you must change the feature flag `enableEgressStore` in the [configuration file](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/main/config/settings/.defaults.yml#L184) to `true`. Note that this feature flag is independent from the Secure Desktop feature flag, but if it is activated by itself, there is nothing preventing the researcher from copying data to their local client (thus outside the egress store).

**Important Notes:**

* Currently, the message goes to the SNS topic - but there is not subscriber added to the topic. It is your responsibility to subscribe to the topic, and to act on the Egress Store data source with elevated permissions through the AWS Management Console.
* When this feature is enabled, the Bring Your Own Buckets (BYOB) data sources are only allowed to be read only. This is because a BYOB data source can live in a different AWS account (unlike MyStudy and Organizational Study that live in the main Service Workbench main account). Allowing write to a BYOB data source would be uncontrolled egress. 

## [3.5.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.4.0...v3.5.0) (2021-10-14)


### Features

* dynamic version number from CHANGELOG and automation of Beta versioning ([#716](https://github.com/awslabs/service-workbench-on-aws/issues/716)) ([5887170](https://github.com/awslabs/service-workbench-on-aws/commit/5887170b4c4af548ea39f2ce7b9c856bc7e9f887))


### Bug Fixes

* build ami version bug ([#738](https://github.com/awslabs/service-workbench-on-aws/issues/738)) ([a39b3b4](https://github.com/awslabs/service-workbench-on-aws/commit/a39b3b4b945254f71b27fe3bdcdda8f819f32069))
* bypass develop protection when adding beta ([#725](https://github.com/awslabs/service-workbench-on-aws/issues/725)) ([fe4c0ff](https://github.com/awslabs/service-workbench-on-aws/commit/fe4c0ffa774e7e418928af11a4bb24e57f55786a))
* downgrade node-ssh version to fix integ tests ([#744](https://github.com/awslabs/service-workbench-on-aws/issues/744)) ([f5ce251](https://github.com/awslabs/service-workbench-on-aws/commit/f5ce251ea110ae73ba34aabe3b6c6032df9901a2))
* integ test setup flakiness fix ([#727](https://github.com/awslabs/service-workbench-on-aws/issues/727)) ([65ea43d](https://github.com/awslabs/service-workbench-on-aws/commit/65ea43daa7430e3bffd60f1563194a035413d765))
* namespace code works with configs with no namespace param ([#717](https://github.com/awslabs/service-workbench-on-aws/issues/717)) ([72c9fe3](https://github.com/awslabs/service-workbench-on-aws/commit/72c9fe39b6c60713546b4d7aae20ae1caca7a526))
* Update libcurl-devel package for RStudio to correct version ([#726](https://github.com/awslabs/service-workbench-on-aws/issues/726)) ([04bb82c](https://github.com/awslabs/service-workbench-on-aws/commit/04bb82c3e3303447e46abc97b306aa31632cc8d6))
* version number before backend deployment ([#724](https://github.com/awslabs/service-workbench-on-aws/issues/724)) ([6d545dd](https://github.com/awslabs/service-workbench-on-aws/commit/6d545dd1d709359fa8f8907e334eef3a65acc0d4))

## [3.4.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.3.1...v3.4.0) (2021-09-16)


### Features

* display Configuration Name and Instance Type on Workspace details card ([#669](https://github.com/awslabs/service-workbench-on-aws/issues/669)) ([f0fa819](https://github.com/awslabs/service-workbench-on-aws/commit/f0fa8191a22c33c9b669d56764cac676e6a1aaaa))
* Pre-populate variable values in input section of new workspace configuration ([#680](https://github.com/awslabs/service-workbench-on-aws/issues/680)) ([8ce51b2](https://github.com/awslabs/service-workbench-on-aws/commit/8ce51b200148108ac869e1a8ae26286b65c94cc1))


### Bug Fixes

* add label to stop timeout during e2e test ([#688](https://github.com/awslabs/service-workbench-on-aws/issues/688)) ([ff0b4cc](https://github.com/awslabs/service-workbench-on-aws/commit/ff0b4ccbb8349df7262469411bf23729be174621))
* end2end test terminated existing ws ([#685](https://github.com/awslabs/service-workbench-on-aws/issues/685)) ([9c74ac7](https://github.com/awslabs/service-workbench-on-aws/commit/9c74ac794aa75b4292291b9fa2f3768bed76eb81))
* github cypress setup ([#686](https://github.com/awslabs/service-workbench-on-aws/issues/686)) ([23f6d03](https://github.com/awslabs/service-workbench-on-aws/commit/23f6d0366f1b82eb569fe9fc363f47248d6e9011))
* go bug during deployment is handled ([#641](https://github.com/awslabs/service-workbench-on-aws/issues/641)) ([4c21a30](https://github.com/awslabs/service-workbench-on-aws/commit/4c21a305943f8c3b8436a0f4f534594ca5425ad4))
* no sagemaker autostop or EC2 stop lag ([#703](https://github.com/awslabs/service-workbench-on-aws/issues/703)) ([8cb199b](https://github.com/awslabs/service-workbench-on-aws/commit/8cb199b8093f5e799d2d87c228930a4929ebebb7))
* properly handle very long error messages on env update ([#705](https://github.com/awslabs/service-workbench-on-aws/issues/705)) ([d920abd](https://github.com/awslabs/service-workbench-on-aws/commit/d920abd8666eaf905810680aec24428e8ce46124))
* reset ForceLogout component upon relogin ([#640](https://github.com/awslabs/service-workbench-on-aws/issues/640)) ([5c2aaee](https://github.com/awslabs/service-workbench-on-aws/commit/5c2aaee79428c3d4e2bceb115b77a6eb477a6add))
* static namespace bug fix ([#615](https://github.com/awslabs/service-workbench-on-aws/issues/615)) ([bacb469](https://github.com/awslabs/service-workbench-on-aws/commit/bacb469d048601cc73f10a3d7145197fbeae8c62))
* sync UI and API func ([#709](https://github.com/awslabs/service-workbench-on-aws/issues/709)) ([a188b3c](https://github.com/awslabs/service-workbench-on-aws/commit/a188b3c918bea677acf5115cec006f50782e83bb))
* update int test readme to include adv test info ([#634](https://github.com/awslabs/service-workbench-on-aws/issues/634)) ([5453f5e](https://github.com/awslabs/service-workbench-on-aws/commit/5453f5e133672bc137bb61d5c3b8bf097152a851))

### Documentation

* New user guide PDF ([#704](https://github.com/awslabs/service-workbench-on-aws/pull/704)) ([d375785](https://github.com/awslabs/service-workbench-on-aws/commit/c560b95574d562dc8fc1c43a8b73bf2c70c3dd9a))

### [3.3.1](https://github.com/awslabs/service-workbench-on-aws/compare/v3.3.0...v3.3.1) (2021-07-26)


### Bug Fixes

* application version number ([#573](https://github.com/awslabs/service-workbench-on-aws/issues/573)) ([fada154](https://github.com/awslabs/service-workbench-on-aws/commit/fada154f0cee6d38722f30446b71ebbde32cb6fb))
* Clear timer in ForceLogout.test.js to allow tests to end ([#570](https://github.com/awslabs/service-workbench-on-aws/issues/570)) ([4871e0f](https://github.com/awslabs/service-workbench-on-aws/commit/4871e0f885a5051b4542c37f72abb9d67f281dce))
* Remove delete user feature from UI and handle study permissions which have stale users ([#595](https://github.com/awslabs/service-workbench-on-aws/issues/595)) ([8be3f90](https://github.com/awslabs/service-workbench-on-aws/commit/8be3f902eea97f53c70373e3e19fb359005ad7f4))


### Chore

* **deps:** bump all dependencies ([#556](https://github.com/awslabs/service-workbench-on-aws/issues/556)) ([46e26af](https://github.com/awslabs/service-workbench-on-aws/commit/46e26af8f7cb34daeb134b7cd732775ad4e61ec4))


### Documentation

* Added details found needed while onboarding ([#593](https://github.com/awslabs/service-workbench-on-aws/issues/593)) ([d375785](https://github.com/awslabs/service-workbench-on-aws/commit/d375785fe5b42f70a2e371b985fd2d5a0dd734bd))
* IDP configuration guide ([#569](https://github.com/awslabs/service-workbench-on-aws/issues/569)) ([406c656](https://github.com/awslabs/service-workbench-on-aws/commit/406c656948993474a9c60889e4f8548fa8b0c108))

## [3.3.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.2.0...v3.3.0) (2021-06-25)

### Documentation

* Service Workbench installation guide ([#545](https://github.com/awslabs/service-workbench-on-aws/issues/545)) ([2be27d1](https://github.com/awslabs/service-workbench-on-aws/commit/2be27d16da5a4c0405648b220a548415eed47ef7))
## [3.2.0](https://github.com/awslabs/service-workbench-on-aws/compare/v3.1.0...v3.2.0) (2021-06-11)


### Features

* Add warning that internal authentication shouldn't be used in production ([#506](https://github.com/awslabs/service-workbench-on-aws/issues/506)) ([1586278](https://github.com/awslabs/service-workbench-on-aws/commit/15862785fb0ade825c251902bd13dea948833c19))
* Encrypt s3 buckets for EMR log bucket and CICD Artifact bucket ([#508](https://github.com/awslabs/service-workbench-on-aws/issues/508)) ([e86fd06](https://github.com/awslabs/service-workbench-on-aws/commit/e86fd0668aa6971e09491ab090586ce825f51069))
* study permissions only shown to Study Admin ([#501](https://github.com/awslabs/service-workbench-on-aws/issues/501)) ([f3eaae8](https://github.com/awslabs/service-workbench-on-aws/commit/f3eaae802c838b92fe95deea3dd4a3ac23c89d3b))


### Bug Fixes

* add termination status for non-found workspaces ([#502](https://github.com/awslabs/service-workbench-on-aws/issues/502)) ([8c30378](https://github.com/awslabs/service-workbench-on-aws/commit/8c30378dd25c02abd3bb3a250a68eccee3b7bca3))
* adds 'stopped' filter for workspaces ([960b592](https://github.com/awslabs/service-workbench-on-aws/commit/960b592341b186f09da12307cca138fd0b4fde25))
* Allow sagemaker to have the proper IAM permission to autostop itself ([#515](https://github.com/awslabs/service-workbench-on-aws/issues/515)) ([32007ed](https://github.com/awslabs/service-workbench-on-aws/commit/32007edb95ee411a0cc4a302c0af247e54d438a0))
* Corrected Spark defaults to fix read/write functionality from Spark ([#526](https://github.com/awslabs/service-workbench-on-aws/issues/526)) ([f96e1bd](https://github.com/awslabs/service-workbench-on-aws/commit/f96e1bde4f535c79b81490888436c9dfb49045c9))
* Do not allow users to change root password ([#503](https://github.com/awslabs/service-workbench-on-aws/issues/503)) ([a436f73](https://github.com/awslabs/service-workbench-on-aws/commit/a436f73bcbf8c9c23bed7ebaa11837ca13628ccb))
* moved notification boxes to avoid blocking the top ribbon. ([#483](https://github.com/awslabs/service-workbench-on-aws/issues/483)) ([5a226d7](https://github.com/awslabs/service-workbench-on-aws/commit/5a226d7a46ccae2d9f741dbeffe24d78e8dad252))
* react compilation error ([#500](https://github.com/awslabs/service-workbench-on-aws/issues/500)) ([547f2ad](https://github.com/awslabs/service-workbench-on-aws/commit/547f2ad9e1d3abfb61dfecc73268da541f243aad))
* Redirect non admin users to "/" if they try to access "/users" ([#489](https://github.com/awslabs/service-workbench-on-aws/issues/489)) ([ee3a58e](https://github.com/awslabs/service-workbench-on-aws/commit/ee3a58e864f2f620358a34063afcbb02adde687c))

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
