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
import { decorate, computed, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Divider, List, Form, TextArea, Message, Button } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';

import YesNo from '@aws-ee/base-ui/dist/parts/helpers/fields/YesNo';
import SelectionButtons from '@aws-ee/base-ui/dist/parts/helpers/fields/SelectionButtons';

import CopyToClipboard from '../../helpers/CopyToClipboard';
import { createForm } from '../../../helpers/form';

const adminOptions = [
  {
    text: 'I have admin access',
    value: 'admin',
  },
  {
    text: 'I do not have admin access',
    value: 'notAdmin',
  },
];

// expected props
// - account (via prop)
// - largeText (via prop) default to false
class AccountCfnPanel extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // We want to create a simple one button form
      const account = props.account || {};
      const { hasUpdateStackUrl } = account.stackInfo || {};
      const fields = {
        managed: {
          value: 'admin',
        },
        createOrUpdate: {
          extra: {
            yesLabel: 'Stack Create',
            noLabel: 'Stack Update',
            yesValue: 'create',
            noValue: 'update',
            showHeader: false,
          },
          value: hasUpdateStackUrl ? 'update' : 'create',
        },
      };
      this.form = createForm(fields);
    });
  }

  get account() {
    return this.props.account || {};
  }

  get stackInfo() {
    return this.account.stackInfo || {};
  }

  get largeText() {
    return this.props.largeText;
  }

  get textSize() {
    return this.largeText ? 'large' : 'medium';
  }

  render() {
    const { id } = this.account;
    const form = this.form;
    const field = form.$('managed');

    return (
      <>
        {this.renderCfnTemplate()}
        <div className="pr3">
          <Divider />
          <div className="flex justify-between">
            <Header as="h4" className="mb0 mt1 flex-auto">
              AWS Account # {id}
            </Header>
            <SelectionButtons field={field} options={adminOptions} show="buttonsOnly" className="mb0" />
          </div>
          <Divider />
        </div>
        {this.renderSteps()}
      </>
    );
  }

  renderCfnTemplate() {
    const stackInfo = this.stackInfo;
    const { name, formattedTemplate } = stackInfo;

    return (
      <Form className="mb3">
        <Header as="h4" className="mb2 mt3">
          CloudFormation Stack Name
        </Header>
        <div className="mb2 flex">
          <div className="flex-auto">
            <Form.Input fluid value={name} size="large" />
          </div>
          <div className="mt1 p0">
            <CopyToClipboard text={name} />
          </div>
        </div>
        <div className="mb2 flex">
          <div className="flex-auto">
            <TextArea value={formattedTemplate} rows={10} />
          </div>
          <div className="mt1 p0">
            <CopyToClipboard text={formattedTemplate} />
          </div>
        </div>
      </Form>
    );
  }

  renderSteps() {
    // We need to determine if this is for creating the stack or updating the stack
    const form = this.form;
    const stackInfo = this.stackInfo;
    const { hasUpdateStackUrl } = stackInfo;
    const field = form.$('createOrUpdate');
    const update = field.value === 'update';
    const hasAdminAccess = form.$('managed').value === 'admin';

    return (
      <>
        <div className="flex justify-between pt3 pb0 pr3 pl1">
          <Header size="medium" className="mb2">
            Steps
          </Header>
          {hasUpdateStackUrl && <YesNo field={field} className="mb0 mt0" />}
        </div>
        {!update && hasAdminAccess && this.renderCreateSteps()}
        {update && hasAdminAccess && this.renderUpdateSteps()}
        {!hasAdminAccess && this.renderEmailTemplate(update)}
      </>
    );
  }

  renderCreateSteps() {
    const account = this.account;
    const textSize = this.textSize;
    const stackInfo = this.stackInfo;
    const { id, mainRegion } = account;
    const { createStackUrl } = stackInfo;

    return (
      <div className="animated fadeIn">
        <List ordered size={textSize}>
          <List.Item>
            In a separate browser tab, login to the aws console using the correct account.
            <Message className="mr3 mt2 mb2">
              <Message.Header>Attention</Message.Header>
              <p>
                Ensure that you are logged in to the aws account # <b>{id}</b> and region <b>{mainRegion}</b>
              </p>
            </Message>
          </List.Item>
          <List.Item>
            Click on the <b>Create Stack</b> button, this opens a separate browser tab and takes you to the
            CloudFormation console where you can review the stack information and provision it.
            <div className="mb0 flex mt2">
              <div className="flex-auto">
                <Button fluid as="a" target="_blank" href={createStackUrl} rel="noopener noreferrer">
                  Create Stack
                </Button>
                {this.renderExpires(stackInfo)}
              </div>
              <div className="mt1 p0">
                <CopyToClipboard text={createStackUrl} />
              </div>
            </div>
          </List.Item>
          <List.Item>
            While the stack is being provisioned, it is okay to navigate away from this page and come back to the Data
            Source list page where you can test the connection once the stack is finished deploying.
          </List.Item>
        </List>
      </div>
    );
  }

  renderUpdateSteps() {
    const account = this.account;
    const stackInfo = this.stackInfo;
    const textSize = this.textSize;
    const { id, mainRegion } = account;
    const { updateStackUrl, cfnConsoleUrl } = stackInfo;

    return (
      <div className="animated fadeIn">
        <List ordered size={textSize}>
          <List.Item>
            In a separate browser tab, login to the aws console using the correct account.
            <Message className="mr3 mt2 mb2">
              <Message.Header>Attention</Message.Header>
              <p>
                Ensure that you are logged in to the aws account # <b>{id}</b> and region <b>{mainRegion}</b>
              </p>
            </Message>
          </List.Item>
          <List.Item>
            Go to the{' '}
            <a target="_blank" rel="noopener noreferrer" href={cfnConsoleUrl}>
              AWS CloudFormation Console
            </a>
            <Message className="mr3 mt2 mb2">
              <p>
                You need to visit the AWS CloudFormation console page before you can click on the Update Stack button
              </p>
            </Message>
          </List.Item>
          <List.Item>
            Click on the <b>Update Stack</b> button, this opens a separate browser tab and takes you to the
            CloudFormation console where you can review the stack information and provision it.
            <div className="mb0 flex mt2">
              <div className="flex-auto">
                <Button fluid as="a" target="_blank" href={updateStackUrl} rel="noopener noreferrer">
                  Update Stack
                </Button>
                {this.renderExpires(stackInfo)}
              </div>
              <div className="mt1 p0">
                <CopyToClipboard text={updateStackUrl} />
              </div>
            </div>
          </List.Item>
          <List.Item>
            While the stack is being provisioned, it is okay to navigate away from this page and come back to the Data
            Source list page where you can test the connection once the stack is finished deploying.
          </List.Item>
        </List>
      </div>
    );
  }

  renderEmailTemplate(update = false) {
    const account = this.account;
    const stackInfo = this.stackInfo;
    const textSize = this.textSize;
    const emailTemplate = update ? account.updateStackEmailTemplate : account.createStackEmailTemplate;

    return (
      <div className="animated fadeIn">
        <List ordered size={textSize}>
          <List.Item>You can use the following email template to send an email to the admin of the account</List.Item>
          <Form className="mb3">
            <div className="flex justify-between">
              <Header as="h4" className="mb2 mt2">
                Email Template
              </Header>
              <div className="mt2 mr4">{this.renderExpires(stackInfo)}</div>
            </div>
            <div className="mb2 flex">
              <div className="flex-auto">
                <TextArea value={emailTemplate} rows={20} />
              </div>
              <div className="mt1 p0">
                <CopyToClipboard text={emailTemplate} />
              </div>
            </div>
          </Form>
        </List>
      </div>
    );
  }

  renderExpires(stackInfo) {
    const { urlExpiry, expired } = stackInfo;

    if (expired) {
      return (
        <div className="fs-9 center color-red mt1">
          Expired <TimeAgo date={urlExpiry} />
        </div>
      );
    }

    return (
      <div className="fs-9 center mt1">
        Expires <TimeAgo date={urlExpiry} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AccountCfnPanel, {
  account: computed,
  stackInfo: computed,
  largeText: computed,
  textSize: computed,
  form: observable,
});

export default inject()(withRouter(observer(AccountCfnPanel)));
