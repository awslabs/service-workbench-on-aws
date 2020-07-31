/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */
import React from 'react';
import { Container, Header, List, Divider } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { observer } from 'mobx-react';

// eslint-disable-next-line react/prefer-stateless-function
class GettingStarted extends React.Component {
  render() {
    return (
      <Container fluid>
        <div className="mt3 mb3 animated fadeIn">
          <Header as="h2">Quick-Start Guide</Header>
          <Header as="h3">Setting up Users</Header>
          <p>
            If you&#39;ve just logged in for the first time, you likely logged in using the &#39;root password&#39;
            provided by Galileo deployment. Please note that logging as the root user is highly discouraged, and should
            only be used for initial setup. You can create a new user by clicking the &quot;Users&quot; tab on the left,
            then &quot;Add Local User&quot;. Follow the instructions given to create the user (don&#39;t worry it if
            says you&#39;re missing a project association), then log out of the root account and into your new user
            account.
          </p>
          <p>
            Once in your user account, you&#39;ll need to link your AWS account. Navigate to &quot;AWS Accounts&quot; in
            the left bar, then click the &quot;AWS Accounts&quot; tab. From here, you can create an AWS account, or link
            an existing one.
          </p>
          <p>
            To create a new AWS account, you&#39;ll need the &quot;Master Role ARN&quot; value, which you can get by
            contacting the owner of your Organization&#39;s master account. If you are the owner, you can find it in the
            Roles section of AWS IAM from the AWS management console. To link an existing account, follow the
            instructions listed. You&#39;ll need the following credentials:
          </p>
          <List bulleted>
            <List.Item>
              <b>AWS Account ID:</b> The ID for your AWS Account. If you do not know where to find this, see{' '}
              <a href="https://www.apn-portal.com/knowledgebase/articles/FAQ/Where-Can-I-Find-My-AWS-Account-ID">
                this page
              </a>
              .
            </List.Item>
            <List.Item>
              <b>Role ARN:</b> An ARN to an IAM Role to use when launching resources using Galileo. You can find or
              create an IAM Role in the IAM service from the{' '}
              <a href="https://aws.amazon.com/console/">AWS management console</a>.
            </List.Item>
            <List.Item>
              <b>AWS Service Catalog Role ARN:</b> Another ARN to an IAM Role, which will be used for launching
              resources using Galileo&#39;s Service Catalog. This entry can be the same as the above if you choose.
            </List.Item>
            <List.Item>
              <b>VPC ID:</b>The ID of the VPC your AWS account uses. You can find this in the VPC Service of the{' '}
              <a href="https://aws.amazon.com/console/">AWS management console</a>.
            </List.Item>
            <List.Item>
              <b>Subnet ID:</b>The ID for the subnet of the VPC to use. This can also be found in the VPC Service of the{' '}
              <a href="https://aws.amazon.com/console/">AWS management console</a>.
            </List.Item>
            <List.Item>
              <b>KMS Encryption Key ARN:</b>The ARN of the KMS Encryption Key to use for the AWS Account. You can find
              or create a KMS Encryption Key in the KMS Service of the{' '}
              <a href="https://aws.amazon.com/console/">AWS management console</a>.
            </List.Item>
          </List>
          <Divider hidden />
          <Header as="h3">Creating Workspaces</Header>
          <p>
            Now that you have a user and have a working AWS account, we can start generating workspaces. Workspaces
            allow you to use AWS resources without having to manually set up and configure them. In order to create a
            workspace, your account has to be associated with a Project, which has to be created under an Index.
          </p>
          <p>
            To start, create an index by navigating to Accounts, clicking the &quot;Indexes&quot; tab, then clicking
            &quot;Add Index&quot;. Each project you create is associated with an index, allowing you to group multiple
            projects together under a single index linked to your AWS account.
          </p>
          <p>
            Next, create a project by clicking the &quot;Projects&quot; tab in the Accounts page, then click &quot;Add
            Project&quot;. Associate it with the Index you just created, and assign yourself as a project admin. Once
            this is completed, you can navigate to the Users page to see that the project has been successfully
            associated with your account.
          </p>
          <p>
            Now that we have a project associated with our account, we can create a workspace! Navigate to the
            Workspaces tab, then click &quot;Create Research Workspace&quot;. This will bring up a menu with a number of
            options. Galileo automatically provisions AWS resources according to your selection, so you can run your
            projects on AWS without having to worry about the setup. Click on your desired platform and then click
            &quot;Next&quot;. You can then fill in the fields (leave &#39;Restricted CIDR&#39; as-is if you don&#39;t
            know what it is) and pick a configuration. Each configuration lists the details for its instance--On Demand
            instances are more expensive than Spot instances, but they&#39;re available whenever you need them. For more
            details on pricing and configurations, please see the{' '}
            <a href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html">
              Instance Purchasing Options
            </a>{' '}
            and the <a href="https://aws.amazon.com/pricing/">AWS Pricing pages</a>.
          </p>
          <p>
            Your workspace may take some time to launch. Once it is up and running, you can connect to it by clicking
            &quot;Connect&quot;. For more details, see the following documentation pages:
          </p>
          <List bulleted>
            <List.Item>
              <b>AWS SageMaker:</b> Galileo takes care of provisioning the workspace for you, so you can jump straight
              to working with SageMaker Notebooks. For more information, see the{' '}
              <a href="https://docs.aws.amazon.com/sagemaker/latest/dg/gs-console.html">
                SageMaker Getting Started Guide
              </a>{' '}
              (you can jump straight to Step 4).
            </List.Item>
            <List.Item>
              <b>AWS ElasticMapReduce (EMR):</b> Galileo takes care of setting up the EMR instance for you, so you can
              jump straight to working with EMR Notebooks. For more information on using EMR Notebooks, see{' '}
              <a href="https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-managed-notebooks.html">
                Using EMR Notebooks
              </a>
              . <b>NOTE:</b> A password may be required to access the EMR Notebooks. By default, this password is
              &#39;go-research-on-aws&#39; (without the quotes).
            </List.Item>
            <List.Item>
              <b>RStudio:</b> See the{' '}
              <a href="https://support.rstudio.com/hc/en-us/sections/200150693-RStudio-Server">
                RStudio Server Documentation
              </a>{' '}
              for assistance.
            </List.Item>
            <List.Item>
              <b>AWS Elastic Compute Cloud (EC2):</b> EC2 omstamces are essentially Virtual Machines in the cloud. For
              more information, see the <a href="https://aws.amazon.com/ec2/">EC2 Documentation</a>.
            </List.Item>
          </List>
          <Divider hidden />
          <Header as="h3">Creating Studies</Header>
          <p>
            Studies are datasets that you can tell Galileo to preload onto your workspaces. When your workspace has
            finished provisioning, you will immediately have access to any datasets within Studies associated with that
            workspace.
          </p>
          <p>
            Studies can be created via the Studies tab in the left bar. You can press &quot;Create Study&quot; to add a
            new study. The ID field will be the ID for that particular dataset. Studies can also be associated to
            projects via the ProjectID selection. Once the study has been created, you can upload datafiles to it with
            the &quot;Upload Files&quot; button.
          </p>
          <p>
            Once you have a study with datafiles loaded, you can start provisioning workspaces with your study data. In
            the Studies tab, select one or more studies. The data in these studies will be preloaded onto the AWS
            compute platform you choose in the next steps. In addition to your own studies, you can also choose from
            your Organization&#39;s studies and/or Open Data studies (publicly available datasets).
          </p>
          <p>
            After choosing your desired studies, click next to continue to create a workspace. Refer to the Workspaces
            section for documentation on the compute platforms offered.
          </p>
          <p>
            Once you have finished determining the properties of your workspace, Galileo will generate your workspace
            and preload it with your study data. You can access it from the Workspaces page by clicking the
            &quot;Connect&quot; button on your workspace.
          </p>
        </div>
      </Container>
    );
  }
}

export default withRouter(observer(GettingStarted));
