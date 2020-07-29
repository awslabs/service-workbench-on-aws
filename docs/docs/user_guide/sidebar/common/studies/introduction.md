---
id: introduction
title: Studies Introduction
sidebar_label: Introduction
---

Galileo enables an organization to provide researchers with a centralized location to search for data sets (studies) and deploy research workspaces with them. Researchers can access a portal, quickly find data that they are interested in and with a few clicks be analyzing it in SageMaker Notebooks, for example.

Galileo also allows an organization to provide access to their data sets, or a subset of their data sets, to external organizations in a controlled way. Further to this, the external organization can use their own AWS account for the research workspace and access the data in the hosting organization.

A user can mount zero or more Studies from each of the levels to their [Workspaces](/user_guide/sidebar/common/workspaces/introduction).

There are 3 types of Studies available.

| Type | Description |
| :--- | :---------- |
| **My Studies** | Studies that are only available to the user that created them. A user can use this to work on datasets that are exclusive to them or that are used specifically for their research. Users can also grant permission to other users in order to allow them access to their studies.|
| **Organization Studies** | Studies that have been shared with the Organization. These could be data that had been collected by efforts of the organization or are licensed to the organization. It is possible to grant or deny users access to this data in order to comply with regulations or licensing restrictions on the data.|
| **Open Data** | Galileo provides access to AWS Open Data Data Sets by frequently scanning the set of AWS Open Datasets and adding new datasets to this category. This can include the 1000 genomes and other datasets openly available through Amazon.|

All Study data is stored in the **studydata**
[S3 Bucket](/deployment/reference/aws_services).
