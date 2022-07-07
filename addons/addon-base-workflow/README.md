# Base Workflow Add-On

This add-on introduces the core workflow functionality. This includes:
-  Workflow steps, workflow templates and workflows

The following sections list the add-on contribution.

## npm packages

- @amzn/workflow-engine
- @amzn/base-workflow-core
- @amzn/base-workflow-steps
- @amzn/base-workflow-templates

## Database tables

- DbStepTemplates
- DbWorkflowTemplates
- DbWorkflowTemplateDrafts
- DbWorkflowDrafts
- DbWorkflows
- DbWorkflowInstances
- DbWfAssignments

## Settings
- New
  - workflowsEnabled
  - workflowStateMachineName
  - workflowStateMachineArn
  - (static) these settings are computed in code:
    - dbStepTemplates
    - dbWorkflowTemplates
    - dbWorkflows
    - dbWorkflowTemplateDrafts
    - dbWorkflowDrafts
    - dbWorkflowInstances
    - dbWfAssignments

- Used
  - dbPrefix

## Runtime extension points
- New
  - 'workflow-steps': { registerWorkflowSteps(stepRegistry) }
  - 'workflow-templates': { registerWorkflowTemplates(templateRegistry) }
  - 'workflows': { registerWorkflows(workflowRegistry) }
  - 'workflow-assignments': { registerWorkflowAssignments(assignmentRegistry) }

- Availability
  - backend SDC
    - backend/src/lambdas/workflow-loop-runner
  - post-deployment SDC
    - post-deployment/src/lambdas/post-deployment

- Used
  - 'service'
  - 'postDeploymentStep'

## New services
- stepRegistryService
- stepTemplateService
- workflowAssignmentRegistryService
- workflowAssignmentService
- workflowDraftService
- workflowInstanceService
- workflowRegistryService
- workflowService
- workflowTemplateDraftService
- workflowTemplateRegistryService
- workflowTemplateService
- workflowTriggerService

## New post deployment steps
- AddStepTemplates
- AddWorkflowAssignments
- AddWorkflowTemplates
- AddWorkflows

## CloudFormation resources
- Workflow Loop Runner Lambda
- Step Functions
- Database tables
- A few IAM roles

## Dependencies
- base Add-on

