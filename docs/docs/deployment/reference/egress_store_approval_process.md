---
id: egress_store_approval_process
title: Exporting data from AppStream-enabled workspaces
sidebar_label: Exporting data from AppStream-enabled workspaces
---

import useBaseUrl from '@docusaurus/useBaseUrl';

As a researcher, if you have AppStream and Egress store enabled, AppStream provides limited access to the workspace that is being used. You can view and use data within that workspace. When you work on this data, it can be saved in the Egress folder, and then a request can be made to export that data. But if you want to export data from that workspace, it requires approval. 

In the following example, you don’t currently have access to the `hello.txt` file out of your workspace. Hence, you need permission to export this file. The **Submit Egress Request** button shown in the figure below is used to export data from your workspace. 

 <img src={useBaseUrl('img/deployment/reference/egress1.png')} />

When you choose **Submit Egress Request**, the file gets picked up by the SNS topic. The SNS topic has following format:

`<env-name>-<AwsRegionName>-<SolutionName>-EgressTopic`

For example, it can look like this:

`prod-iad-sw-EgressTopic`

 <img src={useBaseUrl('img/deployment/reference/egress2.png')} />

The SNS topic allows an administrator to determine which files you would like to export from the workspace. The administrator can subscribe to the SNS topic to receive updates when a user submits an Egress request. For example, the administrator can subscribe a Lambda function to process the Egress submission request or could also provide an email address.

 <img src={useBaseUrl('img/deployment/reference/egress3.png')} />

After subscribing to the SNS topic, the administrator receives information in the following JSON file format:

```
{
      "egress_store_object_list_location": "<REDACTED>/sagemaker-11-egress-store-ver1.json",
      "id": "<REDACTED>",
      "egress_store_id": "<REDACTED>",
      "egress_store_name": "sagemaker-11-egress-store",
      "created_at": "2021-10-15T19:03:09.367Z",
      "created_by": "<REDACTED>",
      "created_by_email": "<REDACTED>@amazon.com",
      "workspace_id": "<REDACTED>",
      "project_id": "proj-new-account-1",
      "s3_bucketname": "<REDACTED>",
      "s3_bucketpath": "<REDACTED>/",
      "status": "PENDING",
      "updated_by": "<REDACTED>",
       "updated_by_email": "<REDACTED>@amazon.com",
      "updated_at": "2021-10-25T18:45:02.883Z",
      "ver": 1
}
```
The `egress_store_object_list_location` section of the code provides the S3 location of a JSON file that lists the files for which the export request has been made by the researcher. For example, the JSON file appears as:
```
{
    "objects": [
        {
           "Key": "ddf05a79-646d-442c-9dd3-88454753a1f2/",
           "LastModified": "2021-12-21T18:49:15.000Z",
           "ETag": "\"ea2dea32611f8e65498d75036cdbf88a\"",
           "Size": 0,
           "StorageClass": "STANDARD",
           "VersionId": "ihxQnhu6DNw2OlKctZjAyj.XxBmEOk4B",
           "Owner": {
                "ID": "c3bc599bfa8ef4ddd90576205045dd986d755dbf80330012efa9bbb00b95d453"
            }
        },
        {
           "Key": "ddf05a79-646d-442c-9dd3-88454753a1f2/hello.txt",
           "LastModified": "2021-12-22T19:39:58.000Z",
           "ETag": "\"61ed55766b67aa6bbad881c12cf1d922\"",
           "Size": 12,
           "StorageClass": "STANDARD",
           "VersionId": "2W0H0AMVor2Zxhw22xOrayf4a9frGxXY",
           "Owner": {
                "ID": "c3bc599bfa8ef4ddd90576205045dd986d755dbf80330012efa9bbb00b95d453"
            }
        }
    ]
}
```
This means that the researcher requested permission for exporting the `hello.txt` file, which is stored in the `ddf05a79-646d-442c-9dd3-88454753a1f2` folder.

The file is stored in an S3 bucket of the main account. The S3 bucket has the following format:

`<aws-account-id>-<env-name>-<AwsRegionName>-<SolutionName>-egress-store`

As an administrator, you can use the information above to approve the file export.