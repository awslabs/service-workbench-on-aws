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
import { inject, observer } from 'mobx-react';
import DefaultLoginScreen from './parts/Login';

class Wrapper extends React.Component {
  renderLogin() {
    return this.props.loginComp;
  }

  renderAuthenticated() {
    const Comp = this.props.Comp;
    const props = this.getWrappedCompProps({ authenticated: true });
    return <Comp {...props} />;
  }

  render() {
    const app = this.props.app;
    let content = null;

    if (app.userAuthenticated) {
      content = this.renderAuthenticated();
    } else {
      content = this.renderLogin();
    }

    return content;
  }

  // private utility methods
  getWrappedCompProps(additionalProps) {
    const props = { ...this.props, ...additionalProps };
    delete props.Comp;
    delete props.loginComp;
    return props;
  }
}

const WrapperComp = inject('app', 'assets')(observer(Wrapper));

function withAuth(Comp, { loginComp } = { loginComp: <DefaultLoginScreen /> }) {
  return function component(props) {
    return <WrapperComp Comp={Comp} loginComp={loginComp} {...props} />;
  };
}

export default withAuth;
