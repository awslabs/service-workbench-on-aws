# Changelog

All notable changes to this project will be documented in this file.

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
