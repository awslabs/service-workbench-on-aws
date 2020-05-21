import React from 'react';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';

export default class PinInput extends React.PureComponent {
  render() {
    const pin = this.props.form.$('pin');
    return <Input field={pin} disabled={this.props.processing} type="password" icon="lock" iconPosition="left" />;
  }
}
