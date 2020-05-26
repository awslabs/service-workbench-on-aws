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
import { decorate, runInAction, action } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Dropdown, Label } from 'semantic-ui-react';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import getUIState from '../workflow-common/component-states/WorkflowCommonCardState';
import WorkflowTemplateCardTabs from './WorkflowTemplateCardTabs';

// expected props
// - template - a WorkflowTemplate model instance (via props)
// - v - the selected version number, will default to latest or existing state (via props)
// - userDisplayName (via injection)
// - location (from react router)
class WorkflowTemplateCard extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      const state = this.getState();
      const versionSpecified = !_.isNil(this.props.v);
      let v;

      if (versionSpecified) {
        v = this.props.v;
      } else if (state.versionNumber === -1) {
        v = this.props.template.latest.v;
      } else {
        v = state.versionNumber;
      }
      state.setVersionNumber(v);
    });
  }

  getState() {
    return getUIState(this.getTemplate().id);
  }

  selectedVersionNumber() {
    return this.getState().versionNumber;
  }

  getTemplate() {
    return this.props.template;
  }

  getTemplateVersion() {
    const template = this.getTemplate();
    const v = this.selectedVersionNumber();
    const version = template.getVersion(v);
    if (_.isEmpty(version)) {
      // This is an error
      displayError(`Version ${v} of this workflow template is not valid`);
      return {};
    }

    return version;
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  handleOnVersionChange = ({ value = 1 }) => {
    this.getState().setVersionNumber(value);
  };

  render() {
    const templateVersion = this.getTemplateVersion();
    const { id, v, title, createdAt, createdBy } = templateVersion;
    const displayNameService = this.getUserDisplayNameService();
    const isSystem = displayNameService.isSystem(createdBy);
    const by = () => (isSystem ? '' : <span className="ml1">by {displayNameService.getDisplayName(createdBy)}</span>);

    return (
      <>
        <Label attached="top left">Template</Label>
        <div className="flex mb1">
          <Header as="h3" color="grey" className="mt0 flex-auto ellipsis">
            {title}
            <Header.Subheader className="fs-9">
              created <TimeAgo date={createdAt} /> {by()}
            </Header.Subheader>
          </Header>
          <div className="ml1">
            <span className="ellipsis pr1 fs-9 breakout color-grey">{id}</span> {this.renderVersionDropdown(v)}
          </div>
        </div>
        {this.renderMainTabs(templateVersion)}
      </>
    );
  }

  renderVersionDropdown(currentVersion) {
    const template = this.getTemplate();
    const versions = template.versionNumbers;
    const options = _.map(versions, version => ({ text: `v${version}`, value: version }));

    if (versions.length === 1) return <span className="bold color-grey pr2">v{template.latest.v}</span>;

    return (
      <Dropdown
        className="color-grey"
        inline
        options={options}
        value={currentVersion}
        onChange={(e, data) => this.handleOnVersionChange(data)}
      />
    );
  }

  renderMainTabs(template) {
    const uiState = this.getState();
    return <WorkflowTemplateCardTabs template={template} uiState={uiState} />;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowTemplateCard, {
  handleOnVersionChange: action,
});

export default inject('userDisplayName')(withRouter(observer(WorkflowTemplateCard)));
