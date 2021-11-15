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
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Header, Segment, Button, Card, Radio, Divider } from 'semantic-ui-react';
import c from 'classnames';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreError, isStoreEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

// expected props
// - onPrevious (via props)
// - onNext (via props) a function is called with the selected envTypeId
// - envTypesStore (via injection)
// - userStore (via injection)
class SelectEnvTypeStep extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.selectedEnvTypeId = undefined;
      this.processing = false;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    swallowError(this.envTypesStore.load());
  }

  goto(pathname) {
    const goto = gotoFn(this);
    goto(pathname);
  }

  get userStore() {
    return this.props.userStore;
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  handleSelectedEnvType = typeId => {
    this.selectedEnvTypeId = typeId;
  };

  handlePrevious = event => {
    event.preventDefault();
    event.stopPropagation();
    if (_.isFunction(this.props.onPrevious)) this.props.onPrevious();
  };

  handleNext = async event => {
    event.preventDefault();
    event.stopPropagation();

    if (_.isFunction(this.props.onNext)) {
      try {
        this.processing = true;
        await this.props.onNext(this.selectedEnvTypeId);
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.processing = false;
        });
      }
    }
  };

  render() {
    const store = this.envTypesStore;
    if (!store) return null;

    let content;
    if (isStoreError(store)) {
      content = this.renderLoadingError();
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder className="mt2" />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else {
      content = this.renderContent();
    }

    return content;
  }

  renderContent() {
    // Logic:
    // - if external researcher and no aws creds configured yet, show a message
    // - if guest (internal/external) show a message
    // - if internal researcher and no project ids, show a message
    // - else show env types card
    const nextDisabled = _.isUndefined(this.selectedEnvTypeId);

    return (
      <div className="mt2 animated fadeIn">
        {this.renderCards()}
        {this.renderButtons({ nextDisabled })}
      </div>
    );
  }

  renderCards() {
    const processing = this.processing;
    const envTypes = this.envTypesStore.listApproved || [];
    const isSelected = type => type.id === this.selectedEnvTypeId;
    const getAttrs = type => {
      const attrs = {};
      if (isSelected(type)) attrs.color = 'blue';
      if (!processing) attrs.onClick = () => this.handleSelectedEnvType(type.id);
      return attrs;
    };

    return (
      <Card.Group stackable itemsPerRow={3}>
        {_.map(envTypes, type => (
          <Card
            data-testid="env-type-card"
            key={type.id}
            raised
            className={c('mb3', { 'cursor-pointer': !processing })}
            {...getAttrs(type)}
          >
            <Card.Content>
              <Card.Header>
                <div className="flex mt1">
                  <Radio className="mr2" checked={isSelected(type)} disabled={processing} />
                  <Header as="h4" className="flex-auto mt0 pt0">
                    {type.name}
                  </Header>
                </div>
                <Divider />
              </Card.Header>
              <Card.Description>
                <div className="mb3 pr1 pl1 pb1">
                  {/* Yes, we are doing dangerouslySetInnerHTML, the content was already sanitized by showdownjs */}
                  {/* eslint-disable-next-line react/no-danger */}
                  <div dangerouslySetInnerHTML={{ __html: type.descHtml }} />
                </div>
              </Card.Description>
            </Card.Content>
          </Card>
        ))}
      </Card.Group>
    );
  }

  renderLoadingError() {
    const store = this.envTypesStore;
    return (
      <>
        <ErrorBox error={store.error} className="p0 mt2 mb3" />
        {this.renderButtons()}
      </>
    );
  }

  renderEmpty() {
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="server" />
            No workspace types
            <Header.Subheader>
              There are no workspace types to choose from. Your role might be restricted. Please contact your
              administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderButtons({ nextDisabled = true } = {}) {
    const processing = this.processing;
    return (
      <div className="mt3">
        <Button
          floated="right"
          icon="right arrow"
          labelPosition="right"
          className="ml2"
          primary
          content="Next"
          loading={processing}
          disabled={nextDisabled || processing}
          onClick={this.handleNext}
        />
        <Button
          floated="right"
          icon="left arrow"
          labelPosition="left"
          className="ml2"
          content="Previous"
          disabled={processing}
          onClick={this.handlePrevious}
        />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(SelectEnvTypeStep, {
  handlePrevious: action,
  handleNext: action,
  handleSelectedEnvType: action,
  userStore: computed,
  envTypesStore: computed,
  processing: observable,
  selectedEnvTypeId: observable,
});

export default inject('userStore', 'envTypesStore')(withRouter(observer(SelectEnvTypeStep)));
