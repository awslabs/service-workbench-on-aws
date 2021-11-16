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
import _ from 'lodash';
import React from 'react';
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Label, Popup, Icon, Divider, Message, Table, Grid, Segment, List } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';
import { niceNumber, swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreNotEmpty, isStoreError } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import { isAppStreamEnabled } from '../../helpers/settings';
import By from '../helpers/By';
import ScEnvironmentButtons from './parts/ScEnvironmentButtons';
import ScEnvironmentCost from './parts/ScEnvironmentCost';

// expected props
// - scEnvironment (via prop)
// - envTypesStore (via injection)
class ScEnvironmentCard extends React.Component {
  get envTypesStore() {
    return this.props.envTypesStore;
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envType() {
    const env = this.props.scEnvironment;
    const store = this.envTypesStore;
    const envType = store.getEnvType(env.envTypeId);

    return envType;
  }

  getEnvTypeConfigsStore() {
    const configsStore = this.envTypesStore.getEnvTypeConfigsStore(this.environment.envTypeId);
    return configsStore;
  }

  getConfiguration(envTypeConfigId) {
    const configsStore = this.getEnvTypeConfigsStore();
    const config = configsStore.getEnvTypeConfig(envTypeConfigId);
    return config;
  }

  componentDidMount() {
    const configsStore = this.getEnvTypeConfigsStore();
    swallowError(configsStore.load());
  }

  render() {
    const configsStore = this.getEnvTypeConfigsStore();
    let content = null;

    if (isStoreError(configsStore)) {
      content = <ErrorBox error={configsStore.error} className="p0" />;
    } else if (isStoreLoading(configsStore)) {
      content = <ProgressPlaceHolder segmentCount={3} />;
    } else if (isStoreNotEmpty(configsStore)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const env = this.environment;
    const state = env.state;

    return (
      <>
        {this.renderStatus(state)}
        {this.renderTitle(env)}
        {this.renderError(env)}
        {this.renderWarning(env)}
        {this.renderLegacyRStudioWarning(env)}
        <Divider className="mt1 mb1" />
        {this.renderButtons(env)}
        <Divider className="mt1" />
        {env.description || 'No description was provided for this workspace.'}
        <Grid columns={2} stackable className="mt2">
          <Grid.Row stretched>
            <Grid.Column width={12}>{this.renderDetailTable(env)}</Grid.Column>
            <Grid.Column width={4}>
              <Segment className="flex items-center">
                <div className="w-100 overflow-hidden">
                  <ScEnvironmentCost envId={env.id} />
                </div>
              </Segment>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </>
    );
  }

  renderDetailTable(env) {
    const studyCount = _.size(_.get(env, 'studyIds', []));
    const envType = this.envType || {};

    const config = this.getConfiguration(this.environment.envTypeConfigId);

    const renderRow = (key, value) => (
      <Table.Row>
        <Table.Cell width={5}>{key}</Table.Cell>
        <Table.Cell width={11} className="breakout">
          {value}
        </Table.Cell>
      </Table.Row>
    );

    return (
      <Table data-testid="environment-card-details-table" definition>
        <Table.Body>
          {renderRow('Owner', <By uid={env.createdBy} skipPrefix />)}
          {renderRow('Studies', studyCount === 0 ? 'No studies linked to this workspace' : niceNumber(studyCount))}
          {renderRow('Project', _.isEmpty(env.projectId) ? 'N/A' : env.projectId)}
          {renderRow('Workspace Type', envType.name)}
          {renderRow('Configuration Name', config !== undefined ? config.name : 'Unavailable')}
          {renderRow('Instance Type', config !== undefined ? config.instanceType : 'Unavailable')}
        </Table.Body>
      </Table>
    );
  }

  renderButtons(env) {
    return <ScEnvironmentButtons scEnvironment={env} showDetailButton />;
  }

  renderStatus(state) {
    return (
      <div style={{ cursor: 'default' }}>
        <Popup
          trigger={
            <Label attached="top left" size="mini" color={state.color}>
              {state.spinner && <Icon name="spinner" loading />}
              {state.display}
            </Label>
          }
        >
          {state.tip}
        </Popup>
      </div>
    );
  }

  renderTitle(env) {
    return (
      <Header as="h3" className="mt1">
        {env.name}
        <Header.Subheader>
          <span className="fs-8 color-grey">
            Created <TimeAgo date={env.createdAt} className="mr2" /> <By uid={env.createdBy} className="mr2" />
          </span>
          <span className="fs-8 color-grey mr2"> {env.id}</span>
        </Header.Subheader>
      </Header>
    );
  }

  renderLegacyRStudioWarning(env) {
    const metaConnection1Type = env.outputs.find(obj => obj.OutputKey === 'MetaConnection1Type');
    if (metaConnection1Type && metaConnection1Type.OutputValue.toLowerCase() === 'rstudio' && env.state.canTerminate) {
      return (
        <>
          <Message
            icon="warning"
            header="Legacy RStudio environment found"
            content="Please terminate this workspace as soon as possible. Support for this environment type has been deprecated. Please use RStudioV2 instead."
          />
          <div className="mt3">
            For more information, refer to the Create RStudio ALB workspace section of our Post Deployment Guide:
          </div>
          <List bulleted>
            <List.Item
              href="https://github.com/awslabs/service-workbench-on-aws/blob/mainline/docs/Service_Workbench_Post_Deployment_Guide.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              Post Deployment Guide
            </List.Item>
          </List>
        </>
      );
    }

    return null;
  }

  renderWarning(env) {
    if (isAppStreamEnabled && !env.isAppStreamConfigured && env.state.canTerminate) {
      return (
        <Message
          icon="warning"
          header="Non-AppStream workspace found"
          content="Please terminate this workspace as soon as possible. This workspace is not supported by AppStream."
        />
      );
    }

    return null;
  }

  renderError(env) {
    if (_.isEmpty(env.error)) return null;

    return (
      <Message negative>
        <p>{env.error}</p>
      </Message>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentCard, {
  envTypesStore: computed,
  environment: computed,
  envType: computed,
});

export default inject('envTypesStore')(withRouter(observer(ScEnvironmentCard)));
