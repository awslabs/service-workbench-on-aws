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
import { decorate } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import c from 'classnames';
import { Container, Header, Segment, Icon, Divider, Label } from 'semantic-ui-react';

import { blueDatasets } from './graphs/graph-options';
import BarGraph from './graphs/BarGraph';

// expected props
// - location (from react router)
class Dashboard extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    return (
      <Container className="mt3 mb4">
        {this.renderTitle()}
        {this.renderContent()}
      </Container>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="dashboard" className="align-top" />
          <Header.Content className="left-align">Dashboard</Header.Content>
        </Header>
      </div>
    );
  }

  stat(title, label, value, color, className) {
    return (
      <div className={c('center', className)}>
        <div className="fs-9">{title}</div>
        <div className={color} style={{ fontSize: '4rem', lineHeight: '1em' }}>
          {value}
        </div>
        <div className="bold" style={{ fontSize: '1rem', lineHeight: '1em' }}>
          {label}
        </div>
      </div>
    );
  }

  renderContent() {
    return (
      <div>
        <Segment color="blue" padded>
          <div className="flex flex-wrap">
            {this.stat('You have to complete', 'TASKS', '550', 'color-blue', 'mr4')}
            {this.renderTaskCountGraph()}
            {this.renderTaskDueGraph()}
          </div>
          <Divider />
          There are{' '}
          <Label circular color="orange" className="mt2">
            100
          </Label>{' '}
          tasks due today. &nbsp;&nbsp;You have been assigned an additional <b>300</b> tasks since last month. There are
          a total of
          <b>10,000</b>
          tasks to complete.
        </Segment>
      </div>
    );
  }

  renderTaskCountGraph() {
    const title = 'Tasks';
    const data = {
      labels: ['Eat', 'Run', 'Walk', 'Sleep', 'Work'],
      datasets: blueDatasets(title, [1, 8, 5, 6, 3]),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderTaskDueGraph() {
    const title = 'Due Date';
    const data = {
      labels: ['Today', 'Tomorrow', 'Yesterday', 'Last Year', 'No'],
      datasets: blueDatasets(title, [1, 8, 5, 6, 3]),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Dashboard, {});

export default inject()(withRouter(observer(Dashboard)));
