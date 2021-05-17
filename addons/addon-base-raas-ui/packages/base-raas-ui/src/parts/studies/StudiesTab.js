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
import { computed, decorate } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Header, Icon, Segment } from 'semantic-ui-react';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import {
  isStoreLoading,
  isStoreError,
  isStoreReady,
  isStoreEmpty,
  stopHeartbeat,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import StudyRow from './StudyRow';
import { categories } from '../../models/studies/categories';

// expected props
// - category (an object with the shape { name, id})
// - studiesStoresMap (via injection)
// - userStore (via injection)
class StudiesTab extends React.Component {
  get studiesStore() {
    return this.props.studiesStoresMap[this.props.category.id];
  }

  componentDidMount() {
    const store = this.studiesStore;
    if (!store) return;
    if (!isStoreReady(store)) swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    stopHeartbeat(this.studiesStore);
  }

  get canCreateStudy() {
    return _.get(this.props.userStore, 'user.capabilities.canCreateStudy', true) && this.hasProjects;
  }

  get canSelectStudy() {
    const can = _.get(this.props.userStore, 'user.capabilities.canSelectStudy', true);
    if (!can) return can; // If can't select study, then return early, no need to examine if the user is internal and does not have projects
    if (!this.isExternalUser) return this.hasProjects;

    return can;
  }

  get isExternalUser() {
    // Both external guests and external researchers are considered external users
    return _.get(this.props.userStore, 'user.isExternalUser', true);
  }

  get hasProjects() {
    return _.get(this.props.userStore, 'user.hasProjects', true);
  }

  render() {
    const studiesStore = this.studiesStore;
    if (!studiesStore) return null;

    // Render loading, error, or tab content
    let content;
    if (isStoreError(studiesStore)) {
      content = <ErrorBox error={studiesStore.error} className="mt3 mr0 ml0" />;
    } else if (isStoreLoading(studiesStore)) {
      content = <BasicProgressPlaceholder segmentCount={3} className="mt3 mr0 ml0" />;
    } else if (isStoreEmpty(studiesStore)) {
      content = this.renderEmpty();
    } else {
      content = this.renderContent();
    }

    return content;
  }

  renderContent() {
    const studiesStore = this.studiesStore;
    const isSelectable = this.canSelectStudy;
    return (
      <div className="mt3 mr0 ml0">
        {studiesStore.list.map(study => (
          <StudyRow key={study.id} study={study} isSelectable={isSelectable} />
        ))}
      </div>
    );
  }

  renderEmpty() {
    const categoryId = this.props.category.id;
    const isOpenData = categoryId === categories.openData.id;
    const isOrgData = categoryId === categories.organization.id;
    const canCreateStudy = this.canCreateStudy;

    let header = 'No studies';
    let subheader = canCreateStudy ? (
      <>
        To create a study, click on the <b>Create Study</b> button at the top.
      </>
    ) : (
      ''
    );

    if (isOpenData) {
      header = 'No studies from the Open Data project';
      subheader = 'The information in this page is updated once a day, please come back later.';
    }

    if (isOrgData) {
      header = 'No studies shared with you';
      subheader = (
        <>
          <div>
            Studies created at the organization level can be shared but you don&apos;t have any that is shared with you.
          </div>
          {canCreateStudy && (
            <div>
              You can create one yourself by clicking on the <b>Create Study</b> button at the top.
            </div>
          )}
          {!canCreateStudy && (
            <div>
              Consider viewing the Open Data studies by clicking on the <span>Open Data</span> tab above.
            </div>
          )}
        </>
      );
    }

    return (
      <Segment placeholder className="mt3">
        <Header icon className="color-grey">
          <Icon name="clipboard outline" />
          {header}
          <Header.Subheader>{subheader}</Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

decorate(StudiesTab, {
  studiesStore: computed,
  canCreateStudy: computed,
  canSelectStudy: computed,
  hasProjects: computed,
  isExternalUser: computed,
});

export default inject('studiesStoresMap', 'userStore')(observer(StudiesTab));
