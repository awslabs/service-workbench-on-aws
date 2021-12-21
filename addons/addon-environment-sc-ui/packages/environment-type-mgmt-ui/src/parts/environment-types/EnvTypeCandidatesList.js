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
import React, { Component } from 'react';
import { action, computed, decorate, observable, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Card, Icon, Divider, Checkbox, Label, Segment, Button, Image } from 'semantic-ui-react';

import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import {
  isStoreEmpty,
  isStoreError,
  isStoreLoading,
  isStoreNotEmpty,
  isStoreReady,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { envMgmtRoleName } from '../../helpers/settings';
import awsServiceCatalogIcon from '../../../images/AWS-Service-Catalog.svg';

// expected props
// - envTypeCandidatesStore (via injection)
class EnvTypeCandidatesList extends Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.showAllVersions = false;
    });
  }

  componentDidMount() {
    swallowError(this.envTypeCandidatesStore.load());
  }

  get envTypeCandidatesStore() {
    return this.props.envTypeCandidatesStore;
  }

  get portfolioId() {
    return this.props.envTypeCandidatesStore.portfolioId;
  }

  render() {
    const store = this.envTypeCandidatesStore;
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0 mb3" />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder />;
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreReady(store) && isStoreNotEmpty(store)) {
      const list = this.envTypeCandidatesList;
      if (_.isEmpty(list)) {
        // The store may not be empty (there may be older versions of the AWS Service Catalog Product)
        // but if the user selected to show only latest versions that are not imported yet then that list
        // may be empty so checking for "isEmpty" here in addition to "isStoreEmpty"
        // check above
        content = this.renderEmpty();
      } else {
        content = this.renderMain();
      }
    } else {
      content = null;
    }

    return (
      <Container className="mt3 mb4">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderTitle() {
    const renderCount = () => {
      const store = this.envTypeCandidatesStore;
      const showCount = isStoreReady(store) && isStoreNotEmpty(store);
      return (
        showCount && (
          <Label circular size="medium">
            {this.envTypeCandidatesList.length}
          </Label>
        )
      );
    };
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          {/* <Icon name="computer" className="align-top" /> */}
          <Image src={awsServiceCatalogIcon} />
          <Header.Content className="left-align">
            AWS Service Catalog Products
            {renderCount()}
          </Header.Content>
          <Header.Subheader className="mt2">
            Available AWS Service Catalog Product Versions not imported yet
          </Header.Subheader>
        </Header>
        <div>
          <Checkbox
            className="version-label"
            toggle
            checked={this.showAllVersions}
            onClick={() => this.handleShowAllVersionsToggle()}
            label={this.showAllVersions ? 'All Versions' : 'Latest Versions'}
          />
          {this.portfolioId && (
            <div data-testid="portfolio-id" className="portfolio-id">
              Portfolio Id: {this.portfolioId}
            </div>
          )}
        </div>
      </div>
    );
  }

  handleShowAllVersionsToggle = () => {
    this.showAllVersions = !this.showAllVersions;
  };

  handleImportButtonClick = id => {
    const goto = gotoFn(this);
    goto(`/workspace-types-management/import/${encodeURIComponent(id)}`);
  };

  renderEmpty() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="computer" />
          No AWS Service Catalog Product Versions available for importing
          <Header.Subheader className="mt2">
            Please create AWS Service Catalog Product Version and share the Portfolio with the AWS IAM role{' '}
            <strong>{envMgmtRoleName}</strong>.
          </Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderMain() {
    const list = this.envTypeCandidatesList;
    if (_.isEmpty(list)) {
      // The store may not be empty (there may be older versions of the AWS Service Catalog Product)
      // but if the user selected to show only latest versions that are not imported yet then that list
      // may be empty so checking for "isEmpty" here in addition to isStoreEmpty check in the render method
      return this.renderEmpty();
    }
    return (
      <Card.Group stackable itemsPerRow={3}>
        {_.map(list, envTypeCandidate => (
          <Card key={`etc-${envTypeCandidate.id}`} raised className="mb3">
            <Card.Content>
              <Header as="h4">{envTypeCandidate.name}</Header>
              <Card.Meta>{_.get(envTypeCandidate, 'provisioningArtifact.name')}</Card.Meta>
              <Divider />
              <Card.Description>
                <div className="mb3 pr1 pl1 pb1">
                  {/* Yes, we are doing dangerouslySetInnerHTML, the content was already sanitized by showdownjs */}
                  {/* eslint-disable-next-line react/no-danger */}
                  <div dangerouslySetInnerHTML={{ __html: envTypeCandidate.descHtml }} />
                </div>
              </Card.Description>
            </Card.Content>
            {envTypeCandidate.metadata.knowMore && (
              <div className="pl-link">
                <div className="ui medium circular label">
                  <i aria-hidden="true" className="info icon pl-link-i" />
                </div>
                <a
                  rel="noopener noreferrer"
                  className="pl-link-km"
                  href={envTypeCandidate.metadata.knowMore}
                  target="_blank"
                >
                  Know More
                </a>
              </div>
            )}
            <Card.Content extra>
              {envTypeCandidate.metadata.partnerName && (
                <a
                  rel="noopener noreferrer"
                  className="partner-label"
                  href={envTypeCandidate.metadata.partnerURL}
                  target="_blank"
                >
                  Provided by {envTypeCandidate.metadata.partnerName}
                </a>
              )}
              <Button
                basic
                icon
                color="blue"
                onClick={() => this.handleImportButtonClick(envTypeCandidate.id)}
                labelPosition="right"
                floated="right"
                size="mini"
              >
                Import
                <Icon name="arrow down" />
              </Button>
            </Card.Content>
          </Card>
        ))}
      </Card.Group>
    );
  }

  get envTypeCandidatesList() {
    return this.showAllVersions
      ? this.envTypeCandidatesStore.listAllVersions
      : this.envTypeCandidatesStore.listLatestVersions;
  }
}

decorate(EnvTypeCandidatesList, {
  envTypeCandidatesList: computed,
  envTypeCandidatesStore: computed,

  showAllVersions: observable,

  handleShowAllVersionsToggle: action,
  handleImportButtonClick: action,
});

export default inject('envTypeCandidatesStore')(withRouter(observer(EnvTypeCandidatesList)));
