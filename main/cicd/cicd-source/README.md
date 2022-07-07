A helper component to configure the AWS Source Account containing the code commit repository for CI/CD 

The component deploys a cloud formation stack in the source account that creates the following resources in the source account:

- `CodeCommitSourceRole`:
  A role that is assumed by the pipeline in the target account to allow the pipeline
  to access the CodeCommit repository and copy source code into an artifact bucket in the target account.
- `CodeCommitEventRole`:
  A role that is assumed by Cloudwatch events to allow Cloudwatch events to publish code change events
  to the default event bus in the target account.
- `CodeCommitEventRule`:
  A Cloudwatch Event rule that forwards code change events to the default event bus in the target account.
