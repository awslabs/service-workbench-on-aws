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
import { observer } from 'mobx-react';
import { action, decorate, runInAction } from 'mobx';
import { Header, Segment } from 'semantic-ui-react';

import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';

import { sessionStore } from '@aws-ee/base-ui/dist/models/SessionStore';
import { getCfnParamsForm } from '../../../../models/forms/CfnParamsForm';
import BaseEnvTypeConfigStep from './BaseEnvTypeConfigStep';

class InputParamsStep extends BaseEnvTypeConfigStep {
  constructor(props) {
    super(props);
    runInAction(() => {
      const cfnParams = _.get(props.envType, 'params');
      const existingParamValues = _.get(props.envTypeConfig, 'params');

      const keyPrefix = this.props.wizardTempStoreKeyPrefix;
      const key = `${keyPrefix}-InputParamsStep`;
      let cfnParamsForm = sessionStore.get(key);
      if (!cfnParamsForm) {
        // Create and save the cfn params form outside of the component (in session store)
        // to make sure the form values are not wiped out on unmount
        // without this if the user clicks next and then previous all entered values will be wiped
        cfnParamsForm = getCfnParamsForm(cfnParams, existingParamValues);
        sessionStore.set(key, cfnParamsForm);
      }

      this.cfnParamsForm = cfnParamsForm;
    });
  }

  render() {
    // The cfnParamsForm below is different from "this.form".
    // cfnParamsForm is specifically for the CloudFormation params and the "this.form" is for the EnvTypeConfig.
    // When the inner form "cfnParamsForm" is submitted, the values from "cfnParamsForm" are read and the field named "params" of
    // the outer EnvTypeConfig form (i.e., "this.form") is set as JSON string
    // See "handleCfnParamsFormSubmit" method for details
    const cfnParamsForm = this.cfnParamsForm;
    return (
      <Segment clearing className="mt3 p3">
        <Form form={cfnParamsForm} onCancel={this.props.onCancel} onSuccess={this.handleCfnParamsFormSubmit}>
          {({ processing, onCancel }) => (
            <>
              {this.renderFormFields({ form: cfnParamsForm, processing, onCancel })}
              {this.renderActionButtons({ processing, onCancel })}
            </>
          )}
        </Form>
      </Segment>
    );
  }

  handleCfnParamsFormSubmit = cfnParamsForm => {
    const cfnParams = [];
    cfnParamsForm.each(field => cfnParams.push({ key: field.key, value: field.value }));

    // Set the params field on the form passed in via props
    const paramsField = this.form.$('params');
    paramsField.value = JSON.stringify(cfnParams);

    this.props.onSubmit(this.form);
  };

  renderFormFields({ form, processing }) {
    const configVarOptions = [];
    const envTypeConfigVars = this.props.envTypeConfigsStore.envTypeConfigVars;
    envTypeConfigVars.forEach(v => {
      configVarOptions.push({
        key: v.name,
        value: `$\{${v.name}}`,
        text: `$\{${v.name}}`,
        content: <Header as="h5" content={v.name} subheader={v.desc} />,
      });
    });

    const fields = [];
    form.each(field => fields.push(field));
    return _.map(fields, field => {
      // if custom literal value was entered instead of selecting from available config vars then field's value may not
      // be in the available options so adding an option for field.value (without this custom drop down values will not
      // pre-populate when editing or when navigating to the step again with "previous")
      const options = _.uniqBy(
        [{ key: field.key, value: field.value, text: field.value }, ...configVarOptions],
        'value',
      );
      return (
        <DropDown
          dataTestId={field.key}
          key={field.key}
          field={field}
          options={options}
          disabled={processing}
          search
          selection
          fluid
          allowAdditions
          clearable
        />
      );
    });
  }
}

decorate(InputParamsStep, {
  handleCfnParamsFormSubmit: action,
});
export default observer(InputParamsStep);
