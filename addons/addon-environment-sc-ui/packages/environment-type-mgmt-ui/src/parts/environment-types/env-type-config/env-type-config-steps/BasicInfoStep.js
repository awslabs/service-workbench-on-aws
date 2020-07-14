import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import BaseEnvTypeConfigStep from './BaseEnvTypeConfigStep';

class BasicInfoStep extends BaseEnvTypeConfigStep {
  renderFormFields({ form, processing }) {
    const envTypConfig = this.getEnvTypeConfig();
    const isUpdating = !_.isEmpty(envTypConfig);

    const idField = form.$('id');
    const nameField = form.$('name');
    const descField = form.$('desc');
    const estimatedCostInfoField = form.$('estimatedCostInfo');

    return (
      <>
        {!isUpdating && <Input field={idField} disabled={processing} />}
        <Input field={nameField} disabled={processing} />
        <TextArea field={descField} disabled={processing} />
        <TextArea field={estimatedCostInfoField} disabled={processing} />
      </>
    );
  }
}

export default observer(BasicInfoStep);
