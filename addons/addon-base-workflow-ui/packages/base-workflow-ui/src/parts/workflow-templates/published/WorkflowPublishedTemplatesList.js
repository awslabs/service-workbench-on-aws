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
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Icon, Segment } from 'semantic-ui-react';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import {
  isStoreLoading,
  isStoreReady,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
} from '@aws-ee/base-ui/dist/models/BaseStore';

import WorkflowTemplateCard from '../WorkflowTemplateCard';
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - workflowTemplatesStore (via injection)
// - location (from react router)
class WorkflowPublishedTemplatesList extends React.Component {
  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStore();
    store.stopHeartbeat();
  }

  getStore() {
    return this.props.workflowTemplatesStore;
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });

    this.props.history.push(link);
  }

  render() {
    const store = this.getStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={3} />;
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreReady(store) && isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <div className="mb4">
        {this.renderTitle()}
        {content}
      </div>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="clipboard outline" />
          No published workflow templates
          <Header.Subheader>
            To create a workflow template, start by creating a draft and then publish the draft.
          </Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="list alternate outline" className="align-top" />
          <Header.Content className="left-align">Published Workflow Templates</Header.Content>
        </Header>
      </div>
    );
  }

  renderMain() {
    const store = this.getStore();
    const list = store.list;

    return (
      <div>
        {list.map((template) => (
          <Segment className="p3 mb2" clearing key={template.id}>
            <WorkflowTemplateCard template={template} />
          </Segment>
        ))}
      </div>
    );
  }
}

export default inject('workflowTemplatesStore')(withRouter(observer(WorkflowPublishedTemplatesList)));
