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
import Dropzone from 'react-dropzone';
import { decorate, observable, runInAction, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Accordion, Header, Icon, Segment, List, Modal, Button, Step, Table } from 'semantic-ui-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { awsRegion } from '@aws-ee/base-ui/dist/helpers/settings';

import { getExternalUserPinForm } from '../../models/forms/ExternalUserPinForm';
import CfnService from '../../helpers/cfn-service';
import PinInput from '../helpers/PinInput';

const steps = {
  IAM_USER: 0,
  CREDENTIALS: 1,
  IAM_POLICY: 2,
  ENCRYPT: 3,
};

const OnboardingSteps = [
  {
    key: 'user',
    icon: 'user',
    title: 'IAM User',
    description: 'Create a user',
    active: true,
  },
  {
    key: 'credentials',
    icon: 'upload',
    title: 'Credentials',
    description: 'Attach credentials',
  },
  {
    key: 'policy',
    icon: 'file alternate outline',
    title: 'IAM Policy',
    description: 'Add permissions',
  },
  {
    key: 'encrypt',
    icon: 'user secret',
    title: 'Encrypt',
    description: 'Encrypt credentials',
  },
];

const generateDefaultIAMPolicy = accountId =>
  `
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ec2",
      "Effect": "Allow",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:CreateKeyPair",
        "ec2:CreateNetworkInterface",
        "ec2:CreateSecurityGroup",
        "ec2:CreateTags",
        "ec2:DeleteKeyPair",
        "ec2:DeleteNetworkInterface",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeDhcpOptions",
        "ec2:DescribeImages",
        "ec2:DescribeInstances",
        "ec2:DescribeKeyPairs",
        "ec2:DescribeNetworkAcls",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeRouteTables",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVolumeStatus",
        "ec2:DescribeVolumes",
        "ec2:DescribeVpcAttribute",
        "ec2:DescribeVpcs",
        "ec2:RunInstances",
        "ec2:TerminateInstances"
      ],
      "Resource": "*"
    },
    {
      "Sid": "cloudformation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks"
      ],
      "Resource": "arn:aws:cloudformation:*:${accountId}:stack/analysis*/*"
    },
    {
      "Sid": "emr",
      "Effect": "Allow",
      "Action": [
        "elasticmapreduce:CreateSecurityConfiguration",
        "elasticmapreduce:DeleteSecurityConfiguration",
        "elasticmapreduce:DescribeCluster",
        "elasticmapreduce:RunJobFlow",
        "elasticmapreduce:TerminateJobFlows"
      ],
      "Resource": "*"
    },
    {
      "Sid": "sagemaker",
      "Effect": "Allow",
      "Action": [
        "sagemaker:CreateNotebookInstance",
        "sagemaker:CreateNotebookInstanceLifecycleConfig",
        "sagemaker:CreatePresignedNotebookInstanceUrl",
        "sagemaker:DeleteNotebookInstance",
        "sagemaker:DeleteNotebookInstanceLifecycleConfig",
        "sagemaker:DescribeNotebookInstance",
        "sagemaker:DescribeNotebookInstanceLifecycleConfig",
        "sagemaker:StopNotebookInstance"
      ],
      "Resource": [
        "arn:aws:sagemaker:*:${accountId}:notebook-instance-lifecycle-config/*",
        "arn:aws:sagemaker:*:${accountId}:notebook-instance/*"
      ]
    },
    {
      "Sid": "iamRoleAccess",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:CreateRole",
        "iam:TagRole",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:DeleteRole",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::${accountId}:role/analysis-*"
    },
    {
      "Sid": "iamInstanceProfileAccess",
      "Effect": "Allow",
      "Action": [
        "iam:AddRoleToInstanceProfile",
        "iam:CreateInstanceProfile",
        "iam:GetInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile"
      ],
      "Resource": "arn:aws:iam::${accountId}:instance-profile/analysis-*"
    },
    {
      "Sid": "iamRoleServicePolicyAccess",
      "Effect": "Allow",
      "Action": [
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy"
      ],
      "Resource": "arn:aws:iam::${accountId}:role/analysis-*",
      "Condition": {
        "ArnLike": {
          "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AmazonElasticMapReduceRole"
        }
      }
    },
    {
      "Sid": "iamServiceLinkedRoleCreateAccess",
      "Effect": "Allow",
      "Action": [
        "iam:CreateServiceLinkedRole",
        "iam:PutRolePolicy"
      ],
      "Resource": "arn:aws:iam::*:role/aws-service-role/elasticmapreduce.amazonaws.com*/AWSServiceRoleForEMRCleanup*",
      "Condition": {
        "StringLike": {
          "iam:AWSServiceName": [
            "elasticmapreduce.amazonaws.com",
            "elasticmapreduce.amazonaws.com.cn"
          ]
        }
      }
    },
    {
      "Sid": "s3",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutBucketTagging"
      ],
      "Resource": "arn:aws:s3:::analysis*"
    },
    {
      "Sid": "ssm",
      "Effect": "Allow",
      "Action": [
        "ssm:DeleteParameter",
        "ssm:GetParameter",
        "ssm:PutParameter"
      ],
      "Resource": "*"
    },
    {
      "Sid": "kms",
      "Effect": "Allow",
      "Action": [
        "kms:CreateGrant",
        "kms:CreateKey",
        "kms:DeleteAlias",
        "kms:DescribeKey",
        "kms:EnableKeyRotation",
        "kms:Encrypt",
        "kms:GenerateDataKeyWithoutPlaintext",
        "kms:GetKeyPolicy",
        "kms:GetKeyRotationStatus",
        "kms:GetParametersForImport",
        "kms:ListAliases",
        "kms:ListGrants",
        "kms:ListKeyPolicies",
        "kms:ListKeys",
        "kms:ListResourceTags",
        "kms:ListRetirableGrants",
        "kms:PutKeyPolicy",
        "kms:ScheduleKeyDeletion",
        "kms:TagResource",
        "kms:UntagResource"
      ],
      "Resource": "*"
    }
  ]
}
`.trim();

// Mapping from credentials.csv column names to preferred, short names
const mapCredentialsColumns = new Map([
  ['User name', 'username'],
  ['Password', 'password'],
  ['Access key ID', 'accessKeyId'],
  ['Secret access key', 'secretAccessKey'],
  ['Console login link', 'console'],
]);

const ListOnboardingIAMUser = (
  <List ordered>
    <List.Item>
      Log into the{' '}
      <a href="https://console.aws.amazon.com/console/home?region=us-east-1#" target="_blank" rel="noopener noreferrer">
        AWS Console
      </a>{' '}
      and navigate to{' '}
      <a
        href="https://console.aws.amazon.com/iam/home?region=us-east-1#/users"
        target="_blank"
        rel="noopener noreferrer"
      >
        IAM Users
      </a>
    </List.Item>
    <List.Item>Click &apos;Add User&apos; and type a new, unique user name</List.Item>
    <List.Item>Under &apos;Select AWS access type&apos;, check &apos;Programmatic access&apos;</List.Item>
    <List.Item>
      Click &apos;Next: Permissions&apos;, then &apos;Next: Tags&apos;, then &apos;Next: Review&apos;
    </List.Item>
    {/* <List.Item>Click &apos;Next: Tags&apos;</List.Item>
    <List.Item>Click &apos;Next: Review&apos;</List.Item> */}
    <List.Item>Click &apos;Create User&apos;</List.Item>
    <List.Item>On the &apos;Add User&apos; success page, click &apos;Download .csv&apos;</List.Item>
    <List.Item>Click &apos;Close&apos;</List.Item>
  </List>
);

const ListOnboardingEncrypt = (
  <List ordered>
    <List.Item>Enter a PIN which will be used to encrypt your AWS credentials</List.Item>
    <List.Item>Remember this PIN because you will need it in future to launch workspaces</List.Item>
  </List>
);

// expected props
// - environmentsStore (via injection)
// - location (from react router)
class UserOnboarding extends React.Component {
  constructor(props) {
    super(props);
    const user = this.getUserStore.user;
    this.form = getExternalUserPinForm();

    runInAction(() => {
      this.user = user;
      this.credentials = undefined;
      this.credentialsValid = false;
      this.accountId = '';
      this.activePolicy = false;
      this.copiedPolicy = '';
      this.onboardingStep = 0;
      this.onboardingSteps = OnboardingSteps.length;
    });
  }

  get getUserStore() {
    return this.props.userStore;
  }

  get getUsersStore() {
    return this.props.usersStore;
  }

  onboardingNext = () => {
    OnboardingSteps[this.onboardingStep].active = false;
    OnboardingSteps[this.onboardingStep + 1].active = true;
    this.onboardingStep += 1;
  };

  onboardingPrev = () => {
    OnboardingSteps[this.onboardingStep].active = false;
    OnboardingSteps[this.onboardingStep - 1].active = true;
    this.onboardingStep -= 1;
  };

  onboardingCredentialsPut = async (creds, pin) => {
    const usersStore = this.getUsersStore;
    await this.user.setEncryptedCreds(creds, pin);
    await usersStore.updateUser(this.user);
    await usersStore.load();
  };

  onboardingSave = () => {
    const pin = this.form.$('pin').value;
    this.onboardingCredentialsPut(this.credentials, pin);
    this.onboardingClose();
  };

  onboardingClose = () => {
    this.resetOnboarding();
    this.props.onclose();
  };

  shouldRenderOnboarding = () => this.user.isExternalUser;

  resetOnboarding = () => {
    OnboardingSteps.forEach(step => {
      step.active = false;
    });
    OnboardingSteps[0].active = true;

    this.credentials = undefined;
    this.credentialsValid = false;
    this.copiedPolicy = '';
    this.onboardingStep = 0;
  };

  renderOnboardingButtons() {
    const nextDisabled = this.onboardingStep === steps.CREDENTIALS && !this.credentialsValid;
    return (
      <>
        <Button content="Cancel" className="mr2" onClick={this.onboardingClose} />
        {this.onboardingStep > 0 && (
          <Button content="Prev" icon="left arrow" labelPosition="left" color="blue" onClick={this.onboardingPrev} />
        )}
        {this.onboardingStep < this.onboardingSteps - 1 && (
          <Button
            content="Next"
            icon="right arrow"
            labelPosition="right"
            color="blue"
            disabled={nextDisabled}
            onClick={this.onboardingNext}
          />
        )}
        {this.onboardingStep === this.onboardingSteps - 1 && (
          <Button content="Save" color="blue" onClick={this.onboardingSave} />
        )}
      </>
    );
  }

  togglePolicy = () => {
    this.activePolicy = !this.activePolicy;
  };

  testClipboardWrite = async () => {
    return new Promise((resolve, _reject) => {
      navigator.permissions.query({ name: 'clipboard-write' }).then(result => {
        resolve(result.state === 'granted' || result.state === 'prompt');
      });
    });
  };

  handleCopyPolicy = () => {
    navigator.clipboard.writeText(generateDefaultIAMPolicy(this.accountId)).then(
      () => {
        /* clipboard successfully set */
        runInAction(() => {
          this.copiedPolicy = 'copied!';
        });
      },
      () => {
        /* clipboard write failed */
        runInAction(() => {
          this.copiedPolicy = 'copy error!';
        });
      },
    );
  };

  ListOnboardingIAMPolicy() {
    return (
      <List ordered>
        <List.Item>
          From the{' '}
          <a
            href="https://console.aws.amazon.com/iam/home?region=us-east-1#/users"
            target="_blank"
            rel="noopener noreferrer"
          >
            IAM user list
          </a>{' '}
          page, click the name of the new IAM user that you just created
        </List.Item>
        <List.Item>
          In the &apos;Get started with permissions&apos; block, click the &apos;Add inline policy&apos; button
        </List.Item>
        <List.Item>On the &apos;Create Policy&apos; page, click the &apos;JSON&apos; tab</List.Item>
        <List.Item>Delete the default policy text</List.Item>
        <List.Item>
          Click to copy a standard IAM policy{' '}
          <Icon name="copy outline" link onClick={this.handleCopyPolicy} title="Copy IAM policy to the clipboard" />
          {this.copiedPolicy}
        </List.Item>
        <List.Item>Paste the copied IAM policy into the IAM console</List.Item>
        <List.Item>Click the &apos;Review Policy&apos; button</List.Item>
        <List.Item>
          Supply a name, for example &apos;compute-launch&apos;, and click &apos;Create Policy&apos;
        </List.Item>
      </List>
    );
  }

  renderOnboardingIAMPolicyText() {
    const showHide = this.activePolicy ? 'hide' : 'show';

    return (
      <Accordion>
        <Accordion.Title active={this.activePolicy} index={0} onClick={this.togglePolicy}>
          <Icon name="dropdown" />
          Click to {showHide} the standard IAM policy
        </Accordion.Title>
        <Accordion.Content active={this.activePolicy}>
          <SyntaxHighlighter language="json" style={docco}>
            {generateDefaultIAMPolicy(this.accountId)}
          </SyntaxHighlighter>
        </Accordion.Content>
      </Accordion>
    );
  }

  handleCredentialsReset = () => {
    this.credentials = undefined;
    this.credentialsValid = false;
  };

  renderOnboardingIAMCredentials() {
    return (
      <Table compact>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Valid</Table.HeaderCell>
            <Table.HeaderCell>IAM User Name</Table.HeaderCell>
            <Table.HeaderCell>Access Key ID</Table.HeaderCell>
            <Table.HeaderCell>Secret Key ID</Table.HeaderCell>
            <Table.HeaderCell>Reset</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              {this.credentialsValid ? <Icon name="check" color="green" /> : <Icon name="delete" color="red" />}
            </Table.Cell>
            <Table.Cell>{this.credentials.username}</Table.Cell>
            <Table.Cell>{this.credentials.accessKeyId}</Table.Cell>
            <Table.Cell>********************</Table.Cell>
            <Table.Cell>
              <Button
                basic
                size="mini"
                icon="trash alternate outline"
                color="red"
                content="Reset"
                title="Reset attached credentials"
                onClick={this.handleCredentialsReset}
              />
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
  }

  credentialsCSVtoJSON(csv) {
    const obj = {};
    const lines = csv.split(/\r?\n/);
    const headers = lines[0].split(',');

    // We only care about the first line of data following the header
    for (let ii = 1; ii < lines.length; ii++) {
      const currentline = lines[ii].split(',');

      for (let jj = 0; jj < headers.length; jj++) {
        const colname = mapCredentialsColumns.get(headers[jj]) || headers[jj];
        obj[colname] = currentline[jj];
      }
      break;
    }

    return obj;
  }

  onCredentialsDrop = files => {
    const reader = new FileReader();

    reader.onabort = () => {
      console.log('file reading was aborted');
      displayError('File reading was aborted.');
    };
    reader.onerror = () => {
      console.log('file reading has failed');
      displayError('File reading has failed.');
    };
    reader.onload = () => {
      const result = reader.result;
      const credentials = this.credentialsCSVtoJSON(result);
      runInAction(() => {
        this.credentials = credentials;
        this.credentials.region = awsRegion;
      });

      // Async IIFE
      (async () => {
        try {
          const rc = await CfnService.validateCredentials(credentials.accessKeyId, credentials.secretAccessKey);
          runInAction(() => {
            this.credentialsValid = true;
            this.accountId = rc.Account;
          });
        } catch (e) {
          displayError(`Credential test failed: ${e}`);
          runInAction(() => {
            this.credentialsValid = false;
          });
        }
      })();
    };
    files.forEach(file => reader.readAsText(file));
  };

  renderCredentialsDropzone() {
    const maxSize = 1000;
    return (
      <Segment className="mt4 center">
        <Header as="h4" color="grey">
          Drag and drop credentials file here
        </Header>
        {/* Note: specifying single accept type causes uiploads to fail on Windows */}
        {/* Was: accept="text/csv" */}
        <Dropzone onDrop={this.onCredentialsDrop} minSize={0} maxSize={maxSize} multiple={false}>
          {({ getRootProps, getInputProps, rejectedFiles, isDragActive }) => {
            const isFileTooLarge = rejectedFiles.length > 0 && rejectedFiles[0].size > maxSize;
            return (
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                {isDragActive ? (
                  <p>Drop the CSV file here ...</p>
                ) : (
                  <p>Drag and drop a credentials.csv files here, or click to select a file</p>
                )}
                {<Icon name="cloud upload" size="huge" color="grey" />}
                {isFileTooLarge && <div className="text-danger mt-2">File is too large.</div>}
              </div>
            );
          }}
        </Dropzone>
      </Segment>
    );
  }

  renderOnboardingIAMUser() {
    return (
      <Modal.Content image>
        <Icon name="user" size="massive" />
        {/* <Image wrapped size="medium" src="https://react.semantic-ui.com/images/avatar/large/rachel.png" /> */}
        <Modal.Description>
          <Header>IAM User</Header>
          <p>
            Please execute the following steps to create a new IAM User that you will use to supply credentials to the
            Research Portal so that we can launch workspaces in your AWS account:
          </p>
          {ListOnboardingIAMUser}
        </Modal.Description>
      </Modal.Content>
    );
  }

  renderOnboardingIAMPolicy() {
    return (
      <Modal.Content image>
        <Icon name="file alternate outline" size="massive" />
        {/* <Image wrapped size="medium" src="https://react.semantic-ui.com/images/avatar/large/matthew.png" /> */}
        <Modal.Description>
          <Header>IAM Policy</Header>
          <p>
            Please execute the following steps to create a new IAM Policy that will provide permissions to the Research
            Portal so that we can launch workspaces in your AWS account:
          </p>
          {this.ListOnboardingIAMPolicy()}
          {this.renderOnboardingIAMPolicyText()}
        </Modal.Description>
      </Modal.Content>
    );
  }

  renderOnboardingCredentials() {
    return (
      <Modal.Content image>
        <Icon name="upload" size="massive" />
        {/* <Image wrapped size="medium" src="https://react.semantic-ui.com/images/avatar/large/elliot.jpg" /> */}
        <Modal.Description>
          <Header>Credentials</Header>
          <p>
            Please attach the credentials file that you downloaded earlier. This contains your new IAM User credentials.
            The default name for this file is credentials.csv but your browser may have saved it under a different name.
          </p>
          {this.credentials && this.renderOnboardingIAMCredentials()}
          {!this.credentials && this.renderCredentialsDropzone()}
        </Modal.Description>
      </Modal.Content>
    );
  }

  renderOnboardingEncrypt() {
    return (
      <Modal.Content image>
        <Icon name="user secret" size="massive" />
        {/* <Image wrapped size="medium" src="https://react.semantic-ui.com/images/avatar/large/molly.png" /> */}
        <Modal.Description>
          <Header>Encrypt</Header>
          <p>
            Finally, we will locally encrypt your AWS credentials with a PIN and then store the encrypted credentials in
            the Research Portal. This will allow you to launch research workspaces using just a PIN.
          </p>
          {ListOnboardingEncrypt}
          <Form form={this.form}>{({ _processing, _onSubmit, _onCancel }) => <PinInput form={this.form} />}</Form>
        </Modal.Description>
      </Modal.Content>
    );
  }

  renderOnboardingStep(step) {
    switch (step) {
      case steps.IAM_USER:
        return this.renderOnboardingIAMUser();
      case steps.CREDENTIALS:
        return this.renderOnboardingCredentials();
      case steps.IAM_POLICY:
        return this.renderOnboardingIAMPolicy();
      case steps.ENCRYPT:
        return this.renderOnboardingEncrypt();
      default:
        return `Unexpected step: ${step}`;
    }
  }

  render() {
    return (
      <>
        <Modal open onClose={this.onboardingClose} closeIcon>
          <Modal.Header>Configure AWS Credentials</Modal.Header>
          <Modal.Content>
            <Step.Group size="tiny" fluid items={OnboardingSteps} />
          </Modal.Content>
          {this.renderOnboardingStep(this.onboardingStep)}
          <Modal.Actions>{this.renderOnboardingButtons()}</Modal.Actions>
        </Modal>
      </>
    );
  }
}

decorate(UserOnboarding, {
  onboardingNext: action,
  onboardingPrev: action,
  resetOnboarding: action,
  togglePolicy: action,
  handleCopyPolicy: action,
  handleCredentialsReset: action,
  onCredentialsDrop: action,
  onRegionChange: action,
  user: observable,
  credentials: observable,
  credentialsValid: observable,
  activePolicy: observable,
  copiedPolicy: observable,
  onboardingStep: observable,
  onboardingSteps: observable,
});
export default inject('userStore', 'usersStore')(withRouter(observer(UserOnboarding)));
