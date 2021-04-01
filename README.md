# Service Workbench on AWS

A platform that provides researchers with one-click access to collaborative workspace environments operating across teams, universities, and datasets while enabling university IT stakeholders to manage, monitor, and control spending, apply security best practices, and comply with corporate governance.

Platform provides one-click option to admins for easier creation (vending) of new AWS accounts specific to researchers' teams for easier governance.

The solution contains the following components:

- solution/infrastructure/
- solution/backend/
- solution/edge-lambda
- solution/machine-images/
- solution/prepare-master-acc
- solution/post-deployment/
- solution/ui/

The solution also includes a Continuous Integration/Continuous Delivery feature:

- main/cicd/cicd-pipeline
- main/cicd/cicd-source

---

## Getting Started

Before you can build this project, please install the following prerequisites.

- **Node.Js:** [Node.js v12.x](https://nodejs.org/en/) or later is required.
- **PNPM:** Install [pnpm](https://pnpm.js.org/en/) as follows

```bash
npm install -g pnpm
```

- **Go:** You also need to install [Go](https://golang.org/doc/install). `Go` is used for creating a multipart S3 downloader tool that is used in AWS Service Catalog EC2 Windows based research environments.

To create the initial settings files, take a look at the example.yml settings file in main/config/settings/example.yml and create your own copy.
The stage is either 'example' or your username. This method should be used only for the very first time you install this solution.
In the rest of this README, \$STAGE is used to designate the stage.

Now, let's perform an initial deployment. Note that when invoked without parameters, this will assume a deployment stage of \$USER, which is the logged-in user name on Mac and Linux systems.

```bash
scripts/environment-deploy.sh
```

You can override the default stage name of \$USER if you prefer. For example, if you want your stage name to be `qa`, then:

1. create main/config/settings/qa.yml
2. execute `scripts/environment-deploy.sh qa`

Following an initial successful deployment, you can subsequently deploy updates to the infrastructure, backend, and post-deployment components as follows:

```bash
cd main/solution/<component>
pnpx sls deploy -s $STAGE
cd -
```

To run (rerun) the post-deployment steps:

```bash
cd main/solution/post-deployment
pnpx sls invoke -f postDeployment -s $STAGE
cd -
```

To re-deploy the UI

```bash
cd main/solution/ui
pnpx sls package-ui --stage $STAGE --local=true
pnpx sls package-ui --stage $STAGE
pnpx sls deploy-ui --stage $STAGE --invalidate-cache=true
cd -
```

To view information about the deployed components (e.g. CloudFront URL, root password), run the
following, where `[stage]` is the name of the environment (defaults to `$STAGE` if not provided):

```bash
scripts/get-info.sh [stage]
```

Once you have deployed the app and the UI, you can start developing locally on your computer.
You will be running a local server that uses the same lambda functions code. To start local development, run the following commands to run a local server:

```bash
cd main/solution/backend
pnpx sls offline -s $STAGE
cd -
```

Then, in a separate terminal, run the following commands to start the ui server and open up a browser:

```bash
cd main/solution/ui
pnpx sls start-ui -s $STAGE
cd -
```

---

## Using Service Workbench

Once Service Workbench is fully deployed, the console will output the Website URL and Root Password for Service Workbench. You can log in by navigating to the Website URL in any browser, and then using the username 'root' and the Root Password given by the console. Please note that logging as the root user is highly discouraged, and should only be used for initial setup. You can create a new user by clicking the "Users" tab on the left, then "Add Local User". Follow the instructions given to create the user (you can leave the 'Project' field blank for now), then log out of the root account and into your new user account.

Once in your user account, you'll need to link your AWS account. Navigate to "AWS Accounts" in the left bar, then click the "AWS Accounts" tab. From here, you can create an AWS account, or link an existing one.

To create a new AWS account, you'll need the "Master Role ARN" value, which you can get by contacting the owner of your Organization's master account. If you are the owner, you can find it in the Roles section of [AWS IAM](https://aws.amazon.com/iam/) from the [AWS management console](https://aws.amazon.com/console/).

To link an existing account, follow the instructions listed. You'll need the following credentials:

- **AWS Account ID** ([Where can I find my AWS Account ID?](https://www.apn-portal.com/knowledgebase/articles/FAQ/Where-Can-I-Find-My-AWS-Account-ID))
- **Role ARN**: An ARN to an IAM Role to use when launching resources using Service Workbench. You can find or create an IAM Role in the IAM service from the [AWS management console](https://aws.amazon.com/console/).
- **AWS Service Catalog Role ARN**: Another ARN to an IAM Role, which will be used for launching resources using Service Workbench's Service Catalog. This entry can be the same as the above if you choose.
- **VPC ID**: The ID of the VPC your AWS account uses. You can find this in the [VPC Service](https://aws.amazon.com/vpc/) of the [AWS management console](https://aws.amazon.com/console/).
- **Subnet ID**: The ID for the subnet of the VPC to use. This can also be found in the [VPC Service](https://aws.amazon.com/vpc/) of the [AWS management console](https://aws.amazon.com/console/).
- **KMS Encryption Key ARN**: The ARN of the KMS Encryption Key to use for the AWS Account. You can find or create a KMS Encryption Key in the [KMS service](https://aws.amazon.com/kms/) of the [AWS management console](https://aws.amazon.com/console/).

## Creating a Workspace

Now that you have a user and have a working AWS account, we can start generating workspaces. Workspaces allow you to use AWS resources without having to manually set up and configure them. In order to create a workspace, your account has to be associated with a Project, which has to be created under an Index.

To start, create an index by navigating to Accounts, clicking the "Indexes" tab, then clicking "Add Index". Each project you create is associated with an index, allowing you to group multiple projects together under a single index linked to your AWS account.

Next, create a project by clicking the "Projects" tab in the Accounts page, then click "Add Project". Associate it with the Index you just created, and assign yourself as a project admin. Once this is completed, you can navigate to the Users page to see that the project has been successfully associated with your account.

Now that we have a project associated with our account, we can create a workspace! Navigate to the Workspaces tab, then click "Create Research Workspace". This will bring up a menu with a number of options. Service Workbench automatically provisions AWS resources according to your selection, so you can run your projects on AWS without having to worry about the setup. Click on your desired platform and then click "Next". You can then fill in the fields (leave 'Restricted CIDR' as-is if you don't know what it is) and pick a configuration. Each configuration lists the details for its instance--On Demand instances are more expensive than Spot instances, but they're available whenever you need them. For more details on pricing and configurations, please see the [Instance Purchasing Options](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html) and the [AWS Pricing](https://aws.amazon.com/pricing/) pages.

Your workspace may take some time to launch. Once it is up and running, you can connect to it by clicking "Connect". For more details, see the following documentation pages:

- AWS SageMaker: Service Workbench takes care of provisioning the workspace for you, so you can jump straight to working with SageMaker Notebooks. For more information, see the [SageMaker Getting Started Guide](https://docs.aws.amazon.com/sagemaker/latest/dg/gs-console.html) (you can jump straight to Step 4).
- AWS ElasticMapReduce (EMR): Service Workbench takes care of setting up the EMR instance for you, so you can jump straight to working with EMR Notebooks. For more information on using EMR Notebooks, see [Using EMR Notebooks](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-managed-notebooks.html). **NOTE:** A password may be required to access the EMR Notebooks. By default, this password is 'go-research-on-aws' (without the quotes).
- RStudio: See the [RStudio Server Documentation](https://support.rstudio.com/hc/en-us/sections/200150693-RStudio-Server) for assistance.
- AWS Elastic Compute Cloud (EC2): EC2 instances are essentially Virtual Machines in the cloud. For more information, see the [EC2 Documentation](https://aws.amazon.com/ec2/).

## Create a Study

Studies are datasets that you can tell Service Workbench to preload onto your workspaces. When your workspace has finished provisioning, you will immediately have access to any datasets within Studies associated with that workspace.

Studies can be created via the Studies tab in the left bar. You can press "Create Study" to add a new study. The ID field will be the ID for that particular dataset. Studies can also be associated to projects via the ProjectID selection. Once the study has been created, you can upload datafiles to it with the "Upload Files" button.

Once you have a study with datafiles loaded, you can start provisioning workspaces with your study data. In the Studies tab, select one or more studies. The data in these studies will be preloaded onto the AWS compute platform you choose in the next steps. In addition to your own studies, you can also choose from your Organization's studies and/or Open Data studies (publicly available datasets).

After choosing your desired studies, click next to continue to create a workspace. Refer to the Workspaces section for documentation on the compute platforms offered.

Once you have finished determining the properties of your workspace, Service Workbench will generate your workspace and preload it with your study data. You can access it from the Workspaces page by clicking the "Connect" button on your workspace.

---

## Code Customization

Start by looking at these files:

- main/packages/services/lib/hello/hello-service.js
- main/packages/controllers/lib/hello-controller.js
- main/solution/ui/src/parts/hello/HelloPage.js

They are meant to provide a sample service, a sample controller and a sample UI page.

---

## Audits

To audit the installed NPM packages, run the following commands:

```bash
cd <root of git repo>
pnpm audit
```

Please follow prevailing best practices for auditing your NPM dependencies and fixing them as needed.

---

## Recommended Reading

- [Serverless Framework for AWS](https://serverless.com/framework/docs/providers/aws/)
- [Serverless Stack](https://serverless-stack.com/)
- [Configure Multiple AWS Profiles](https://serverless-stack.com/chapters/configure-multiple-aws-profiles.html)
- [Serverless Offline](https://github.com/dherault/serverless-offline)

## Docusaurus

You can now also launch the Service Workbench docusaurus website. Please follow the steps in docs/README.md

## License

This project is licensed under the terms of the Apache 2.0 license. See [LICENSE](LICENSE).
Included AWS Lambda functions are licensed under the MIT-0 license. See [LICENSE-LAMBDA](LICENSE-LAMBDA).

## Feedback

We'd love to hear from you! Please reach out to our team via GitHub Issues for any feedback.
