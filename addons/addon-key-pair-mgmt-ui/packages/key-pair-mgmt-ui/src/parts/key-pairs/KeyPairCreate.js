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
