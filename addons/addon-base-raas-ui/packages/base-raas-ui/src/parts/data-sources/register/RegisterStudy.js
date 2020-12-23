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
import { decorate, computed, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Icon } from 'semantic-ui-react';

import Stores from '@aws-ee/base-ui/dist/models/Stores';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import InputStep from './InputStep';
import SubmitStep from './SubmitStep';
import CfnStep from './CfnStep';
import StartStep from './StartStep';

// expected props
// - dataSourceAccountsStore (via injection)
class RegisterStudy extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.accountsStore, this.usersStore]);
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    swallowError(this.stores.load());
  }

  get accountsStore() {
    return this.props.dataSourceAccountsStore;
  }

  get usersStore() {
    return this.props.usersStore;
  }

  get wizard() {
    return this.props.registerStudyWizard;
  }

  render() {
    const stores = this.stores;

    let content = null;
    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0" />;
    } else if (stores.loading) {
      content = <ProgressPlaceHolder segmentCount={1} />;
    } else if (stores.ready) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3 animated fadeIn">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderMain() {
    const wizard = this.wizard;
    if (wizard.isStartStep) return <StartStep wizard={wizard} />;
    if (wizard.isInputStep) return <InputStep wizard={wizard} />;
    if (wizard.isSubmitStep) return <SubmitStep wizard={wizard} />;
    if (wizard.isCfnStep) return <CfnStep wizard={wizard} />;

    return null;
  }

  renderTitle() {
    return (
      <Header as="h3" className="color-grey mt1 mb3">
        <Icon name="database" className="align-top" />
        <Header.Content className="left-align">Data Sources</Header.Content>
      </Header>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(RegisterStudy, {
  usersStore: computed,
  accountsStore: computed,
  wizard: computed,
});

export default inject(
  'dataSourceAccountsStore',
  'usersStore',
  'registerStudyWizard',
)(withRouter(observer(RegisterStudy)));
