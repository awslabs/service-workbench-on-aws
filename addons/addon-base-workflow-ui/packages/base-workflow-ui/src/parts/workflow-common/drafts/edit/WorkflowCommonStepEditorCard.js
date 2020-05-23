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
import { observer, inject } from 'mobx-react';
import { decorate, action, computed } from 'mobx';
import { Segment, Icon, Accordion } from 'semantic-ui-react';

// expected props
// - stepEditor - a WorkflowStepEditor model or a WorkflowTemplateStepEditor model (via props)
// - onDelete - called when the step is to be deleted, passed (step) (via props)
// - canDelete (via props) defaults to true
// - canMove (via props) defaults to true
// - className (via props)
class WorkflowCommonStepEditorCard extends React.Component {
  get contentExpanded() {
    return this.getStepEditor().contentExpanded;
  }

  getStepEditor() {
    return this.props.stepEditor;
  }

  getStep() {
    return this.getStepEditor().step;
  }

  get canDelete() {
    return this.props.canDelete === undefined ? true : this.props.canDelete;
  }

  get canMove() {
    return this.props.canMove === undefined ? true : this.props.canMove;
  }

  handleExpandContent = event => {
    event.stopPropagation();
    event.preventDefault();

    const editor = this.getStepEditor();
    editor.setContentExpanded(!this.contentExpanded);
  };

  handleDelete = event => {
    event.stopPropagation(); // this was needed, otherwise, the handleClick was called after
    // which resulted in mobx state tree warning about instance being accessed after being deleted
    const onDelete = this.props.onDelete || _.noop;

    onDelete(this.getStep());
  };

  render() {
    const className = this.props.className || 'p0 pl1';
    const step = this.getStep();

    return (
      <Segment size="small" className={className} clearing>
        {this.renderContent(step)}
      </Segment>
    );
  }

  renderContent(step) {
    const opened = this.contentExpanded;
    const canDelete = this.canDelete;
    const canMove = this.canMove;

    return (
      <Accordion className="overflow-hidden pr1">
        <Accordion.Title active={opened} index={0} onClick={this.handleExpandContent}>
          <div className="flex">
            {canMove && (
              <div className="ml1 mr1 mt1 cursor-grab">
                <Icon name="align justify" color="grey" />
              </div>
            )}
            {!canMove && <div className="ml1 mr1 mt1" />}
            <Icon name="dropdown" className="mt75" />
            <div className="ellipsis flex-auto mt1">
              <div className="ellipsis">{step.derivedTitle || step.title}</div>
              <div className="ellipsis pr1 breakout fs-9 color-grey">
                {step.templateId} v{step.templateVer}
              </div>
            </div>
            {canDelete && (
              <div className="pl1 pr1 pt1" onClick={this.handleDelete}>
                <Icon name="trash alternate outline" className="cursor-pointer" />
              </div>
            )}
          </div>
        </Accordion.Title>
        <Accordion.Content active={opened} className="p2 pt3 mb1 cursor-default">
          {this.props.children}
        </Accordion.Content>
      </Accordion>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowCommonStepEditorCard, {
  contentExpanded: computed,
  canDelete: computed,
  canMove: computed,
  handleDelete: action,
  handleExpandContent: action,
});

export default inject()(observer(WorkflowCommonStepEditorCard));
