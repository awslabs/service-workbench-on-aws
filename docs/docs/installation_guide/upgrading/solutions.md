---
id: solutions
title: Upgrading AWS solution installation
sidebar_label: Upgrading AWS solution installation
---

This procedure is for upgrading Service Workbench installations automatically installed from the AWS solution. In this installation model, a CloudFormation template initiates the installation, which is performed by AWS CodeBuild project.  To upgrade a Service Workbench deployment, you need access to the Service Workbench installation.

1. Log in to the AWS Management Console for the account where Service Workbench is installed.
2. Open the AWS CodeBuild console and locate the Service Workbench project with the name `swb-Setup`.
3. Enter the project, click on the most recent successful build, and open the **Environment Variables** tab.  Note the following values:
     - `OBJECT_KEY_NAME`: Record the version number (for example: ‘1.4.3’) from this string, which is used as part of the URL from where to download the Service Workbench source code.
     - `SOLUTION_NAME`: Default value is `swb`.
     - `STAGE_NAME`: Default value is `test`.
4. In the **Build projects** page:
     - For **Edit**, choose **Environment**.
     - Expand the **Additional configuration** section.
5. Edit the value of `OBJECT_KEY_NAME` and set it to `service-workbench-on-aws/v1.4.5`.
6. If necessary, set the values of `SOLUTION_NAME` and `STAGE_NAME` to match those previously used.
7. Choose **Update environment**, which returns you to the **Build projects** page.
8. Choose **Start build**.  The project runs for 20-30 minutes.
9. Test the deployment by visiting the site URL.
10. Update each account in Service Workbench by following the instructions in [Post upgrade](/installation_guide/postupgrade) section.  
