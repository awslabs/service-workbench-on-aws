---
id: introduction
title: Studies Introduction
sidebar_label: Introduction
---

Service Workbench enables an organization to provide researchers with multiple ways to connect compute workspaces to data (Studies) residing in Amazon S3. Researchers use the Service Workbench to quickly find data that they are interested in — and with a few clicks start working with it using the tools of their choice.

Service Workbench also allows an organization to provide access to Studies to external organizations with access control. 

There are 3 types of Studies available. Users can mount multiple Studies, of any type, to their [Workspaces](/user_guide/sidebar/common/workspaces/introduction).

| Type                     | Description                                                                                                                                                                                                                                                                                               |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **My Studies**           | Studies owned by the user that created them. A user can use this to work on datasets that are exclusive to them or that are used specifically for their research.                        |
| **Organization Studies** | Studies that can be shared with other users. These could be data that had been collected by efforts of the organization or are licensed to the organization. It is possible to grant or deny users access to this data in order to comply with regulations or licensing restrictions on the data. |
| **Open Data**            | Service Workbench provides access to [Open Data on AWS](https://aws.amazon.com/opendata/) data by frequently scanning the set of AWS Open Datasets and adding new datasets to this category. This can include the 1,000 genomes and other datasets openly available through Amazon.                                                          |

Service Workbench can host data for My Studies and Organization Studies internally, in the `studydata` 
[S3 Bucket](/deployment/reference/aws_services) created in the AWS account where Service Workbench was deployed. The application can also provide access to Studies hosted in external S3 buckets in other AWS accounts via the Data Sets page.