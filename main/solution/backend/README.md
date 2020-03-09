# Backend

## Packaging and deploying

To package cfn without deploying it

```bash
$ pnpx sls package --stage <stage name>
```

To deploy:

```bash
$ pnpx sls deploy --stage <stage name>
```

## Useful commands

To list all resolved variables:

```bash
$ pnpx sls print --stage <stage name>
```

## Overview of Lambda Functions

The Research Portal is a serverless solution. Its backend application logic is implemented on API Gateway and AWS Lambda. Some of the backend AWS Lambda functions are:

- API Handler

  This is responsible for processing API calls received via API Gateway. It runs the Express server. API requests are handled by controllers, which delegate execution of business logic to application services. These services interface with the AWS Services via the AWS SDK for JavaScript and Node.js.

  This Lambda function implements the route handling for all /api/_ API calls made by clients. This Lambda function is invoked, after authentication and authorization, every time a client makes a /api/_ HTTP request to the backend. Clients include the web UI as well as any CLI tools that were built, or will in the future be built.

- Authentication Handler

  A Lambda authorizer (formerly known as a custom authorizer) is an API Gateway feature that uses a Lambda function to control access to an API.

  This Lambda function provides an authentication layer in front of the API. It ensures that all requests come from authenticated clients before they hit the backend API. This is the first layer of a common microservices pattern protecting your business logic. IMPORTANT: this lambda does NOT perform any application authorization logic.

  This lambda function is the Custom Authorizer for the Research Portal. It's an entry point for the authentication layer for the API, as it intercepts authentication token, then delegates to authenticationService for authentication decisions.

- Workflow Loop Runner

  This is called by the AWS Step Functions' State Machine. Handles workflow input and configuration, payload, states, wait conditions, and execution of workflow steps, which could be long-running (in contrast, AWS Lambda runtime is limited to 15 minutes). This allows for composable and flexible workflows within the application.
