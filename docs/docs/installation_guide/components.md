---
id: components
title: Service Workbench installation components
sidebar_label: Installation components
---

### Serverless framework and projects

Service Workbench on AWS is a serverless environment that is deployed using an event-driven API framework. Its components are spread across [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/operatorguide/intro.html) instances, static webpages using [Amazon CloudFront](https://aws.amazon.com/cloudfront/), and [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html). It can use Amazon Cognito for authentication. Service Workbench relies on [AWS Service Catalog](https://aws.amazon.com/servicecatalog/?aws-service-catalog.sort-by=item.additionalFields.createdDate&aws-service-catalog.sort-order=desc) to host and manage [AWS CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html) templates that define the Workspaces. Service Workbench contains five serverless projects. You can find these components under the `<service_workbench>/main/solution` directory.

| Component      | Installation Directory | What does it contain? |
| ----------- | ----------- |---------|
| Infrastructure      | `solution/infrastructure/`       |The following AWS resources are created as part of this component deployment:<br /><ul><li>S3 bucket is used for logging the following actions:<ul><li> Studying data uploads.</li><li>Accessing CloudFormation templates’ bucket.</li><li>Accessing CloudFront distribution service.</li><li>Hosting the static Service Workbench website.</li></ul><li>CloudFront distribution service to accelerate Service Workbench website access based on user location.</li></li></ul> |
| Backend   | `solution/backend/`       |After the environment has been deployed, the backend component creates and configures the following AWS resources:<br /><b>S3 bucket</b><ul><li>Stores uploaded study data. This bucket also receives an encryption key from [AWS Key Management Service](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) for encrypting this data and making it available to the Service Workbench website.</li><li>Stores bootstrap scripts. These scripts are used to launch the Workspace instances like SageMaker, EC2, Amazon EMR.</li><li>Sets up IAM roles and policies for accessing Lambda functions and invoking step functions.</li></ul>|
| [Amazon DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)   | Backend SDC creates DynamoDB tables        |Stores information concerning user authentication, AWS accounts, workflows, access tokens, study data etc. This component is also responsible for deploying the following Lambda functions/services:<br /><ul><li>Authentication layer handler - Handles the authentication layer for API handlers.</li><li>Open data scrape handler - Handles scraping the metadata from the AWS open data registry.</li><li>API handler - Provides a path for public and protected API operations.</li><li>Workflow loop runner - Invoked by AWS Step Functions.</li></ul>|
| Edge Lambda   | `main/solution/edge-lambda`                  |An inline JavaScript interceptor function that adds security headers to the CloudFront output response. This function is declared inline because the code requires API Gateway URL for the backend API operations.     |
| Machine images   | `solution/machine-images/`        |Deploys spot instances using machine images for EC2 and Amazon EMR templates.     |
| Prepare master accounts   | `main/solution/prepare-master-acc`         |Creates a master IAM role for organization access.     |
| Post deployment  | `solution/post-deployment/`        |Creates an IAM role for the post deployment function with policies granting permission to S3 buckets, DynamoDB tables, KMS encryption key, CloudFront, and Lambda functions.    |
| User interface  | `solution/ui/`        |Contains code used to create and support the UI functionality of the application.     |

### Continuous integration/continuous delivery 

Service Workbench includes the continuous integration/continuous delivery feature:
+ `cicd/cicd-pipeline/serverless.yml`
+ `cicd/cicd-source/serverless.yml`


