---
id: software_req
title: Software requirements
sidebar_label: Software requirements
---

| Software      | Functions |
| ----------- | ----------- |
| Main AWS account      | Deploys Service Workbench. We recommend you to dedicate an AWS account to this deployment. Additionally, you will also need admin access to the AWS accounts where you want to deploy Workspaces.       |
| [AWS Command Line Interface (CLI)](https://aws.amazon.com/cli/)       | Starts AWS services from your terminal. You must have appropriate AWS programmatic credentials ready. You must also have appropriate rights to deploy the platform on an AWS account.        |
| Packer installation   | <ul><li>Installs and manages JavaScript packages specified in the platform’s dependencies. See [Pnpm](https://pnpm.io/installation). </li><li>Builds JavaScript files. See [Node.js](https://nodejs.org/en/).</li><li>Builds and packages the code for cloud deployment. See [Serverless framework](https://www.serverless.com/).</li></ul>      |