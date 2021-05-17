---
id: logs
title: Viewing logs
sidebar_label: Viewing Service Workbench Logs
---

### Viewing Service Workbench logs in CloudWatch ###
Service Workbench has API Gateway access logging enabled. The logs are available in CloudWatch at the ```/aws/api-gateway/<name of your API>``` log group:


Following is the format of the access logs:
```
{
    "authorizer.principalId": "u-000000000000",
    "error.message": "-",
    "extendedRequestId": "ZuT4rGDNoAMFxXw=",
    "httpMethod": "GET",
    "identity.sourceIp": "22.22.222.22",
    "integration.error": "-",
    "integration.integrationStatus": "200",
    "integration.latency": "79",
    "integration.requestId": "67394741-90ae-4c6c-94fb-df8bf7be33ec",
    "integration.status": "200",
    "path": "/dev/api/user-roles",
    "requestId": "468a1b4d-3015-4901-b749-37e4e0551029",
    "responseLatency": "83",
    "responseLength": "819",
    "stage": "dev",
    "status": "200"
}
```
Lambda logs are also available in CloudWatch with the default log group names ```/aws/lambda/<lambda function name>```.

### Metrics ###

The default metrics for Lambda and API Gateway are available in CloudWatch. For the full list of available metrics, see:

 + [Working with AWS Lambda function metrics - AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html)
 + [Amazon API Gateway dimensions and metrics - Amazon API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-metrics-and-dimensions.html) 

Service Workbench does not emit any custom metrics. 


