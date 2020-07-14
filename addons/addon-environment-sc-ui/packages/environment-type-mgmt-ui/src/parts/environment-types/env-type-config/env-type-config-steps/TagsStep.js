import React from 'react';
import { observer } from 'mobx-react';
import { action, decorate, observable } from 'mobx';
import { Header } from 'semantic-ui-react';

import BaseEnvTypeConfigStep from './BaseEnvTypeConfigStep';

class TagsStep extends BaseEnvTypeConfigStep {
  // eslint-disable-next-line no-unused-vars
  renderFormFields({ form, processing }) {
    return <Header>Coming soon...</Header>;
  }
}

decorate(TagsStep, {
  handleFormSubmission: action,

  stores: observable,
});
export default observer(TagsStep);
