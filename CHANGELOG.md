# Changelog

All notable changes to this project will be documented in this file.

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
