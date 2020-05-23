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
import dvr from 'mobx-react-form/lib/validators/DVR';
import validatorjs from 'validatorjs';
import MobxReactForm from 'mobx-react-form';

const formPlugins = Object.freeze({
  dvr: dvr(validatorjs),
});

const formOptions = Object.freeze({
  showErrorsOnReset: false,
});

function createForm(fields, pluginsParam, optionsParam) {
  const plugins = pluginsParam || formPlugins;
  const options = optionsParam || formOptions;
  return new MobxReactForm({ fields }, { plugins, options });
}

/**
 * Creates a MobxReactForm specific to the field identified by the specified fieldName from the given fields.
 * @param fieldName Name of the field to create MobxReactForm for
 * @param fields An array of MobxReactForm fields OR an object containing the form fields.
 * See MobxReactForm documentation about fields https://foxhound87.github.io/mobx-react-form/docs/fields/ for more details.
 *
 * @param value Optional value for the field
 * @param pluginsParam Optional plugin parameters for the MobxReactForm
 * @param optionsParam Optional options parameters for the MobxReactForm
 */
function createSingleFieldForm(fieldName, fields, value, pluginsParam, optionsParam) {
  // An array of MobxReactForm fields OR an object containing the form fields
  // Find field with the given fieldName from the fields
  // In case of Array: It has shape [ {fieldName1:field1}, {fieldName2:field2} ]
  // In case of Object: It has shape { fieldName1:field1, fieldName2:field2 }
  const fieldsObj = _.isArray(fields) ? _.find(fields, field => _.keys(field)[0] === fieldName) : fields;
  const fieldOfInterest = _.get(fieldsObj, fieldName);

  if (!fieldOfInterest) {
    throw new Error(`Field not found. Can not create form for field ${fieldName}.`);
  }
  const fieldWithValue = _.assign({}, { value }, fieldOfInterest);
  const fieldsToUse = { [fieldName]: fieldWithValue };
  return createForm(fieldsToUse, pluginsParam, optionsParam);
}

export { formPlugins, formOptions, createForm, createSingleFieldForm };
