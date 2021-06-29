# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
