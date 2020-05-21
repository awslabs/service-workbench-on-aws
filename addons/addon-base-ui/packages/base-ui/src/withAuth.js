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
