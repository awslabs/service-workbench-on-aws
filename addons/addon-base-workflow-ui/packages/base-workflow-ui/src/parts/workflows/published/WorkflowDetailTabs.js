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
import { observer, inject, Observer } from 'mobx-react';
import { decorate, action } from 'mobx';
import { Tab, Grid, Label, Segment } from 'semantic-ui-react';

import PropertySection from '../../workflow-templates/PropertySection';
import WorkflowTemplateStep from '../../workflow-templates/WorkflowTemplateStep';
import WorkflowInstancesList from './WorkflowInstancesList';
import WorkflowAssignmentsList from './WorkflowAssignmentsList';

// expected props
// - workflow - either a WorkflowVersion model instance (via props)
// - uiState - to keep track of the active tab (via props)
// - className (via props)
class WorkflowDetailTabs extends React.Component {
  getState() {
    return this.props.uiState;
  }

  selectedMainTabIndex() {
    return this.getState().mainTabIndex;
  }

  getVersion() {
    return this.props.workflow;
  }

  handleTabChange = (event, data) => {
    this.getState().setMainTabIndex(data.activeIndex);
  };

  render() {
    const className = this.props.className || 'mt0';
    const workflow = this.getVersion();
    const id = workflow.id;
    const v = workflow.v;

    const activeIndex = this.selectedMainTabIndex();
    const panes = [
      {
        menuItem: 'Instances',
        render: () => (
          <Tab.Pane basic attached={false} className="mt0 pt0">
            <WorkflowInstancesList workflowVersion={workflow} id={id} v={v} />
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Assignment',
        render: () => (
          <Tab.Pane basic attached={false}>
            <WorkflowAssignmentsList workflowVersion={workflow} />
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Steps',
        render: () => (
          <Tab.Pane basic attached={false}>
            <Observer>{() => this.renderSteps(workflow)}</Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Properties',
        render: () => (
          <Tab.Pane basic attached={false}>
            <PropertySection model={workflow} />
          </Tab.Pane>
        ),
      },
    ];

    return (
      <Tab
        className={className}
        activeIndex={activeIndex}
        menu={{ secondary: true, pointing: true }}
        panes={panes}
        onTabChange={this.handleTabChange}
      />
    );
  }

  renderSteps(workflow) {
    const steps = workflow.selectedSteps || [];

    if (steps.length === 0) {
      return <span>No steps are provided</span>;
    }

    return (
      <Grid padded={false} className="animated">
        {_.map(steps, (step, index) => (
          <Grid.Row key={index} className="pb0">
            <Grid.Column width={1}>
              <Label circular className="mt1 mb1">
                {index + 1}
              </Label>
            </Grid.Column>
            <Grid.Column width={15}>
              <Segment className="p0 pl1 flex">
                <WorkflowTemplateStep step={step} />
              </Segment>
            </Grid.Column>
          </Grid.Row>
        ))}
      </Grid>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowDetailTabs, {
  handleTabChange: action,
});

export default inject()(observer(WorkflowDetailTabs));
