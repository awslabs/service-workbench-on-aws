import _ from 'lodash';
import React from 'react';
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Label, Popup, Icon, Divider, Message, Table, Grid, Segment } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';
import { niceNumber } from '@aws-ee/base-ui/dist/helpers/utils';

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

  render() {
    const env = this.environment;
    const state = env.state;

    return (
      <>
        {this.renderStatus(state)}
        {this.renderTitle(env)}
        {this.renderError(env)}
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

    const renderRow = (key, value) => (
      <Table.Row>
        <Table.Cell width={5}>{key}</Table.Cell>
        <Table.Cell width={11} className="breakout">
          {value}
        </Table.Cell>
      </Table.Row>
    );

    return (
      <Table definition>
        <Table.Body>
          {renderRow('Owner', <By uid={env.createdBy} skipPrefix />)}
          {renderRow('Studies', studyCount === 0 ? 'No studies linked to this workspace' : niceNumber(studyCount))}
          {renderRow('Project', _.isEmpty(env.projectId) ? 'N/A' : env.projectId)}
          {renderRow('Workspace Type', envType.name)}
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
