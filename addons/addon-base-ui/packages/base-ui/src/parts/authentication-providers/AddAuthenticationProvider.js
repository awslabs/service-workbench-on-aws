import { inject, observer } from 'mobx-react';
import { Component } from 'react';

// expected props
// - authenticationProviderConfigsStore (via injection)
class AddAuthenticationProvider extends Component {
  render() {
    return 'TODO: IMPLEMENT';
  }
}

export default inject('authenticationProviderConfigsStore')(observer(AddAuthenticationProvider));
