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
import { Container, Breadcrumb, Segment } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import KeyPairCreateForm from './parts/KeyPairCreateForm';

// expected props
class KeyPairCreate extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    return (
      <Container className="mt3 animated fadeIn">
        {this.renderBreadcrumb()}
        {this.renderForm()}
      </Container>
    );
  }

  renderForm() {
    const goto = gotoFn(this);
    return (
      <Segment clearing className="p3 mb3">
        <KeyPairCreateForm onCancel={() => goto('/key-pair-management')} />
      </Segment>
    );
  }

  renderBreadcrumb() {
    const goto = gotoFn(this);

    return (
      <Breadcrumb className="block mb3">
        <Breadcrumb.Section link onClick={() => goto('/key-pair-management')}>
          SSH Keys
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section active>Create Key</Breadcrumb.Section>
      </Breadcrumb>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(KeyPairCreate, {});

export default inject()(withRouter(observer(KeyPairCreate)));
