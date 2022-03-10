---
id: introduction
title: Workspaces Introduction
sidebar_label: Introduction
---

Service Workbench enables organizations to provide researchers with a centralized location to search for data sets and deploy research workspaces. Researchers can access a portal, quickly find data they are interested in, and quickly begin analysis in SageMaker Notebooks, for example.

Service Workbench also allows an organization to provide access to their data sets, or a subset of their data sets, to external organizations in a controlled way. In addition, the external organization can use their own AWS account for the research workspace and access the data in the hosting organization.

Once a user has found the Study or Studies that they are interested in performing research on, they can deploy a Workspace to attach the data to and carry our research.

A Workspace is an environment that contains a set of tools to access and integrate data. The following environments are currently provided:

Note: There's currently a 10K limit on the number of workspaces that can be created in one SWB environment. 

- **SageMaker Notebook** - A SageMaker Jupyter Notebook with TensorFlow, Apache MXNet and Scikit-learn2
- **EMR** - An Amazon EMR research workspace with Hail 0.2, JupyterLab, Spark 2.4.4 and Hadoop 2.8.52.     
     **Note**: EMR workspaces are not available if AppStream is enabled for the deployment.
- **EC2 - Linux** - An EC2 Linux instance.
- **EC2 - Windows** - An EC2 Windows instance.
- **EC2 - RStudio** - An EC2 RStudio instance.
