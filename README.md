# AWS Galileo Gateway

A platform that provides researchers with one-click access to collaborative workspace environments operating across teams, universities, and datasets while enabling university IT stakeholders to manage, monitor, and control spending, apply security best practices, and comply with corporate governance.

Platform provides one-click option to admins for easier creation (vending) of new AWS accounts specific to researchers' teams for easier governance.  

For more information about various AWS accounts see [aws-accounts-readme.md](main/documentation/aws-accounts-readme.md).

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

Node.js v12.x or later is required.

Before you can build this project, you need to install [pnpm](https://pnpm.js.org/en/). Run the following command:

```bash
$ npm install -g pnpm
```

To create the initial settings files, take a look at the example.yaml settings file in main/config/example.yaml and create your own copy.
The stage is either 'example' or your username. This method should be used only for the very first time you install this solution.
In the rest of this README, \$STAGE is used to designate the stage.

Now, let's perform an initial deployment:

```bash
$ scripts/environment-deploy.sh
```

Following an initial successful deployment, you can subsequently deploy updates to the infrastructure, backend, and post-deployment components as follows:

```bash
$ cd main/solution/<component>
$ pnpx sls deploy -s $STAGE
$ cd -
```

To run (rerun) the post-deployment steps:

```bash
$ cd main/solution/post-deployment
$ pnpx sls invoke -f postDeployment -s $STAGE
$ cd -
```

To re-deploy the UI

```bash
$ cd main/solution/ui
$ pnpx sls package-ui --stage $STAGE --local=true
$ pnpx sls package-ui --stage $STAGE
$ pnpx sls deploy-ui --stage $STAGE --invalidate-cache=true
$ cd -
```

To view information about the deployed components (e.g. CloudFront URL, root password), run the
following, where `[stage]` is the name of the environment (defaults to `$STAGE` if not provided):

```bash
scripts/get-info.sh [stage]
```

Once you have deployed the app and the UI, you can start developing locally on your computer.
You will be running a local server that uses the same lambda functions code. To start local development, run the following commands to run a local server:

```bash
$ cd main/solution/backend
$ pnpx sls offline -s $STAGE
$ cd -
```

Then, in a separate terminal, run the following commands to start the ui server and open up a browser:

```bash
$ cd main/solution/ui
$ pnpx sls start-ui -s $STAGE
$ cd -
```

---

## Audits

To audit the installed NPM packages, run the following commands:

```bash
$ cd <root of git repo>
$ pnpm audit
```

Please follow prevailing best practices for auditing your NPM dependencies and fixing them as needed.

---

## Recommended Reading

- [Serverless Framework for AWS](https://serverless.com/framework/docs/providers/aws/)
- [Serverless Stack](https://serverless-stack.com/)
- [Configure Multiple AWS Profiles](https://serverless-stack.com/chapters/configure-multiple-aws-profiles.html)
- [Serverless Offline](https://github.com/dherault/serverless-offline)

## License

This project is licensed under the terms of the Apache 2.0 license. See [LICENSE](LICENSE).
Included AWS Lambda functions are licensed under the MIT-0 license. See [LICENSE-LAMBDA](LICENSE-LAMBDA).
