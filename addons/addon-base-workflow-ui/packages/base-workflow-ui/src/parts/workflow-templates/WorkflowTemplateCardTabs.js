import _ from 'lodash';
import React from 'react';
import { observer, inject, Observer } from 'mobx-react';
import { decorate, action } from 'mobx';
import { Tab, Grid, Label, Segment } from 'semantic-ui-react';

import PropertySection from './PropertySection';

import WorkflowTemplateStep from './WorkflowTemplateStep';

// expected props
// - template - either a WorkflowTemplateVersion model instance (via props)
// - uiState - to keep track of the active tab (via props)
// - className (via props)
class WorkflowTemplateCardTabs extends React.Component {
  getState() {
    return this.props.uiState;
  }

  selectedMainTabIndex() {
    return this.getState().mainTabIndex;
  }

  getTemplate() {
    return this.props.template;
  }

  handleOnTabChange = (_event, data) => {
    this.getState().setMainTabIndex(data.activeIndex);
  };

  render() {
    const className = this.props.className || 'mt0';
    const template = this.getTemplate();

    const activeIndex = this.selectedMainTabIndex();
    /* eslint-disable react/no-danger */
    const panes = [
      {
        menuItem: 'Description',
        render: () => (
          <Tab.Pane basic attached={false}>
            <Observer>
              {() => <div className="animated" dangerouslySetInnerHTML={{ __html: template.descHtml }} />}
            </Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Steps',
        render: () => (
          <Tab.Pane basic attached={false}>
            <Observer>{() => this.renderSteps(template)}</Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Properties',
        render: () => (
          <Tab.Pane basic attached={false}>
            <PropertySection model={template} />
          </Tab.Pane>
        ),
      },
    ];
    /* eslint-enable react/no-danger */

    return (
      <Tab
        className={className}
        activeIndex={activeIndex}
        menu={{ secondary: true, pointing: true }}
        panes={panes}
        onTabChange={this.handleOnTabChange}
      />
    );
  }

  renderSteps(template) {
    const steps = template.selectedSteps || [];

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
decorate(WorkflowTemplateCardTabs, {
  handleOnTabChange: action,
});

export default inject()(observer(WorkflowTemplateCardTabs));
