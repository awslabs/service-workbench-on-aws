---
id: ec2install
title: Installing Service Workbench using EC2 instance
sidebar_label: Installation using EC2 instance
---

1. Download the Service Workbench on AWS source code using this link and then run the following commands:
```
sudo yum install -y git
git clone https://github.com/awslabs/service-workbench-on-aws.git
```

2. Create a main Service Workbench on AWS conﬁguration ﬁle for your installation. To do this:

      a. Create an environment variable holding the stage name of your installation. The stage name is included in the name of the Amazon S3 storage bucket. Hence, it must be S3-compatible.
      
      Example:
      `export STAGE_NAME=dev`

      Note: Set the environment variable when you open a new terminal window.

      b. In the main conﬁguration directory (`main/config/settings`), make a copy of the example conﬁguration ﬁle using the suggested stage name demo. This creates the `dev.yml` file.
      
      `cp example.yml ${STAGE_NAME}.yml`
   
      c. In the newly created conﬁguration ﬁle, uncomment and set values for the following values:<br />
       - awsRegion (for example: `us-east-1` or `eu-west-2`): Ensure that you use the same Region when you are using the AWS Management Console.<br />
       - solutionName (for example: `sw`): The solutionName is used in S3 bucket names so must be S3-compatible.<br />
       **Note**: Ensure that there is no leading space before the value name.

3. Run the main installation script. This takes up to 15 minutes and can be run in parallel with the next step (installing AMIs).
`./scripts/environment-deploy.sh ${STAGE_NAME}`
4. Once the preceding step has completed, capture the root password and website URL. You can display the URL and root password again by running the following command:
`scripts/get-info.sh ${STAGE_NAME}`
5. Verify that Service Workbench is running by using the URL and root password, using the user `root`.

