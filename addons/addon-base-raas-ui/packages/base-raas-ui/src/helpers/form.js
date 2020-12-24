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

import dvr from 'mobx-react-form/lib/validators/DVR';
import validatorjs from 'validatorjs';
import MobxReactForm from 'mobx-react-form';
import isCidr from 'is-cidr';
import * as baseFormHelper from '@aws-ee/base-ui/dist/helpers/form';

const dvrRules = {
  cidr: {
    validatorFn: value => {
      const result = isCidr(value);
      return result === 4 || result === 6;
    },
    message: 'The :attribute is not in the CIDR format.',
  },
};

// Extend base formPlugins and add support for "cidr" validation rule
const formPlugins = {
  ...baseFormHelper.formPlugins,
  dvr: dvr({
    package: validatorjs,
    extend: ({ validator }) => {
      Object.keys(dvrRules).forEach(key => validator.register(key, dvrRules[key].validatorFn, dvrRules[key].message));
    },
  }),
};

const formOptions = baseFormHelper.formOptions;

function createForm(fields, pluginsParam, optionsParam) {
  const plugins = pluginsParam || formPlugins;
  const options = optionsParam || formOptions;
  return new MobxReactForm({ fields }, { plugins, options });
}

function createFormSeparatedFormat(definitions, pluginsParam, optionsParam) {
  const plugins = pluginsParam || formPlugins;
  const options = optionsParam || formOptions;
  return new MobxReactForm(definitions, { plugins, options });
}
const createSingleFieldForm = baseFormHelper.createSingleFieldForm;

export { formPlugins, formOptions, createForm, createSingleFieldForm, createFormSeparatedFormat };
