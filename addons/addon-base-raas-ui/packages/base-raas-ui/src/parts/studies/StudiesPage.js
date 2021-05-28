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

/* eslint-disable max-classes-per-file */
import React from 'react';
import _ from 'lodash';
import { decorate, action, observable, computed } from 'mobx';
import { observer, inject, Observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Icon, Button, Label, Header, Tab, Message, Menu } from 'semantic-ui-react';
import { niceNumber } from '@aws-ee/base-ui/dist/helpers/utils';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import { isStoreError, isStoreNew, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import { categories } from '../../models/studies/categories';
import StudiesTab from './StudiesTab';
import CreateStudy from './CreateStudy';
import StudyStepsProgress from './StudyStepsProgress';

// This component is used with the TabPane to replace the default Segment wrapper since
// we don't want to display the border.
// eslint-disable-next-line react/prefer-stateless-function
class TabPaneWrapper extends React.Component {
  render() {
    return <>{this.props.children}</>;
  }
}

// expected props
// - filesSelection (via injection)
// - studiesStoresMap (via injection)
// - userStore (via injection)
class StudiesPage extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  getStudiesStore(category) {
    return this.props.studiesStoresMap[category.id];
  }

  goto(pathname) {
    const goto = gotoFn(this);
    goto(pathname);
  }

  get canCreateStudy() {
    // Note, this does not cover the case if you can create a study but don't have any project linked with you yet.
    return _.get(this.props.userStore, 'user.capabilities.canCreateStudy', true);
  }

  get canSelectStudy() {
    return _.get(this.props.userStore, 'user.capabilities.canSelectStudy', true);
  }

  get isExternalUser() {
    // Both external guests and external researchers are considered external users
    return _.get(this.props.userStore, 'user.isExternalUser', true);
  }

  get hasProjects() {
    return _.get(this.props.userStore, 'user.hasProjects', true);
  }

  handleNext = () => {
    if (this.envTypeId) {
      this.goto(`/studies/setup-workspace/type/${encodeURIComponent(this.envTypeId)}`);
    } else {
      this.goto('/studies/setup-workspace');
    }
  };

  render() {
    const canSelectStudy = this.canSelectStudy;

    return (
      <Container className="mt3">
        {this.renderTitle()}
        {canSelectStudy && this.renderStepsProgress()}
        {this.renderSelection()}
        {this.renderStudyTabs()}
      </Container>
    );
  }

  renderTitle() {
    const canCreateStudy = this.canCreateStudy;
    const hasProjects = this.hasProjects;
    return (
      <div className="flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="book" className="align-top" />
          <Header.Content className="left-align">Studies</Header.Content>
        </Header>
        {canCreateStudy && hasProjects && <CreateStudy />}
      </div>
    );
  }

  renderStepsProgress() {
    return <StudyStepsProgress envTypeImmutable={!!this.envTypeId} />;
  }

  renderStudyTabs() {
    const isExternalUser = this.isExternalUser;
    const getMenuItemLabel = category => {
      const store = this.getStudiesStore(category);
      const emptySpan = null;
      if (!store) return emptySpan;
      if (isStoreError(store)) return emptySpan;
      if (isStoreNew(store)) return emptySpan;
      if (isStoreLoading(store)) return emptySpan;
      return <Label>{niceNumber(store.total)}</Label>;
    };

    // Create tab panes for each study category. If the user is not external user, then myStudies pane should not be shown
    const applicableCategories = _.filter(categories, category => {
      if (category.id === 'my-studies' && isExternalUser) return false;
      return true;
    });

    const studyPanes = _.map(applicableCategories, category => ({
      menuItem: (
        <Menu.Item data-testid="table-tab" key={category.id}>
          {category.name} {getMenuItemLabel(category)}
        </Menu.Item>
      ),
      render: () => (
        <Tab.Pane attached={false} key={category.id} as={TabPaneWrapper}>
          <Observer>{() => <StudiesTab category={category} />}</Observer>
        </Tab.Pane>
      ),
    }));

    return (
      <Tab
        data-testid="studies-table"
        className="mt3"
        menu={{ secondary: true, pointing: true }}
        renderActiveOnly
        panes={studyPanes}
      />
    );
  }

  renderSelection() {
    const selection = this.props.filesSelection;
    const empty = selection.empty;
    const count = selection.count;
    const canCreateStudy = this.canCreateStudy;
    const canSelectStudy = this.canSelectStudy;
    const hasProjects = this.hasProjects;

    if (empty && canCreateStudy && canSelectStudy && hasProjects) {
      return this.renderWarningWithButton({
        content: (
          <>
            Select one or more studies to proceed to the next step or create a study by clicking on <b>Create Study</b>{' '}
            button at the top.
          </>
        ),
      });
    }

    if (empty && canCreateStudy && canSelectStudy && !hasProjects) {
      return this.renderWarning({
        header: 'Missing association with one or more projects!',
        content:
          "You won't be able to select or create studies because you currently don't have any association with one or more projects, please contact your administrator.",
      });
    }

    if (empty && canSelectStudy && !canCreateStudy) {
      return this.renderWarningWithButton({
        content: 'Select one or more studies to proceed to the next step.',
      });
    }

    if (empty) {
      return this.renderWarning({
        header: 'Limited access',
        content:
          'You currently have limited access and will not be able to select studies to proceed to the next step.',
      });
    }

    return (
      <Message visible className="clearfix" info>
        <Button icon labelPosition="right" className="ml2" floated="right" onClick={this.handleNext} color="blue">
          Next
          <Icon name="right arrow" />
        </Button>
        {// If envTypeId is present then it means we landed on this page after
        // env type selection from workspace-type-management page.
        // Show previous button in this case to allow to go back to workspace-type-management screen
        this.envTypeId && (
          <Button
            floated="right"
            icon="left arrow"
            labelPosition="left"
            className="ml2"
            content="Previous"
            onClick={this.handlePrevious}
          />
        )}
        <div className="mt1">
          <span>
            Selected studies
            <Label circular color="blue" className="ml1">
              {niceNumber(count)}
            </Label>{' '}
          </span>
        </div>
      </Message>
    );
  }

  renderWarning({ header, content }) {
    return (
      <Message icon warning className="mt2">
        <Icon name="warning" />
        <Message.Content>
          <Message.Header>{header}</Message.Header>
          <p>{content}</p>
        </Message.Content>
      </Message>
    );
  }

  renderWarningWithButton({ content }) {
    return (
      <Message visible className="clearfix" warning>
        <Button icon labelPosition="right" className="ml2" floated="right" disabled>
          Next
          <Icon name="right arrow" />
        </Button>
        {// If envTypeId is present then it means we landed on this page after
        // env type selection from workspace-type-management page.
        // Show previous button in this case to allow to go back to workspace-type-management screen
        this.envTypeId && (
          <Button
            floated="right"
            icon="left arrow"
            labelPosition="left"
            className="ml2"
            content="Previous"
            onClick={this.handlePrevious}
          />
        )}
        <div className="mt1">{content}</div>
      </Message>
    );
  }

  handlePrevious = () => {
    this.goto('/workspace-types-management');
  };

  get envTypeId() {
    return (this.props.match.params || {}).envTypeId;
  }
}

decorate(StudiesPage, {
  getStudiesStore: observable,
  canCreateStudy: computed,
  canSelectStudy: computed,
  hasProjects: computed,
  isExternalUser: computed,
  handleNext: action,
});

export default inject('filesSelection', 'studiesStoresMap', 'userStore')(withRouter(observer(StudiesPage)));
