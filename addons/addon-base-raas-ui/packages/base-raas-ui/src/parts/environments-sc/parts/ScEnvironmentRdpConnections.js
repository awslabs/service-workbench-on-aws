import _ from 'lodash';
import React from 'react';
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Header, Table } from 'semantic-ui-react';

import ScEnvironmentRdpConnectionRow from './ScEnvironmentRdpConnectionRow';

// expected props
// - environment (via prop)
class ScEnvironmentRdpConnections extends React.Component {
  get environment() {
    return this.props.scEnvironment;
  }

  // Returns only the connections that scheme = 'rdp'
  // [ {id, name: <string>(optional), instanceId: <string>, scheme: 'rdp'}, ... ]
  get connections() {
    const connections = this.environment.getConnections(item => item.scheme === 'rdp');

    return connections;
  }

  render() {
    const env = this.environment;
    const state = env.state;
    const canConnect = state.canConnect;
    const empty = _.isEmpty(this.connections);

    if (!canConnect) return null;
    let content = null;

    if (empty) {
      content = this.renderEmpty();
    } else {
      content = this.renderConnections();
    }

    return <div className="fadeIn animated">{content}</div>;
  }

  renderConnections() {
    const env = this.environment;
    const connections = this.connections;

    return (
      <div className="mt2 mb2 fadeIn animated">
        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="1">RDP Connections</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {_.map(connections, item => (
              <ScEnvironmentRdpConnectionRow key={item.id} scEnvironment={env} connectionId={item.id} />
            ))}
          </Table.Body>
        </Table>
      </div>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder className="mt2 mb2">
        <Header icon className="color-grey">
          <Icon name="linkify" />
          No RDP Connections
          <Header.Subheader>This workspace does not have any defined RDP connections.</Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentRdpConnections, {
  environment: computed,
  connections: computed,
});

export default inject()(withRouter(observer(ScEnvironmentRdpConnections)));
