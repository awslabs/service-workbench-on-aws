---
id: introduction
title: Studies Introduction
sidebar_label: Introduction
---

Service Workbench provides multiple ways to connect compute workspaces to data (Studies) saved in Amazon S3. As a researcher, you can also use it to search data using tools specific to your requirements.  

Using Service Workbench, an organization can share Studies with other organizations with access controls. 

There are three types of Studies available in Service Workbench. You can mount multiple Studies, of any type, to your [Workspaces](/user_guide/sidebar/common/workspaces/introduction).

| Type                     | Description                                                                                                                                                                                                                                                                                               |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **My Studies**           | Specifies Studies created by users. Use this option to work on datasets that are exclusive to you or that are used specifically for your research.                        |
| **Organization Studies** | Specifies Studies that can be shared with other users.  It contains data that had been collected by an organization or is licensed. You can grant or deny users access to this data in order to comply with regulations or licensing restrictions on the data. |
| **Open Data**            | Service Workbench provides access to [Open Data on AWS](https://aws.amazon.com/opendata/) data by frequently scanning the set of AWS open datasets and adding new datasets to this category. This can include 1,000 genomes and other datasets openly available through Amazon.                                                          |

Service Workbench can host data for My Studies and Organization Studies internally, in the `studydata` 
[S3 Bucket](/deployment/reference/aws_services) created in the AWS account where Service Workbench was deployed. The application can also provide access to Studies hosted in external S3 buckets in other AWS accounts using the **Datasets** page.