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
import { action, decorate, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { Dropdown } from 'semantic-ui-react';
import c from 'classnames';

import Header from './Header';
import Description from './Description';
import ErrorPointer from './ErrorPointer';

// expected props
// - field (via props), this is the mobx form field object
// - options (via props), an array of [ {text, value}, {text, value}, ...]
// - onChange (via props), (optional) if provided, it will be given (value, field)
// - className (via props)
//
// The following props are to support existing React Semantic UI props:
// - selection (via props), default to false
// - fluid (via props), default to false
// - disabled (via props), default to false
// - clearable (via props), default to false
// - multiple (via props), default to false
// - search (via props), default to false
// - allowAdditions (via props), default to false
// - className (via props), default to 'mb4'
// - additionLabel (via props), default to 'Custom Value:'
const DEFAULT_SELECTION = false;
const DEFAULT_FLUID = false;
const DEFAULT_DISABLED = false;
const DEFAULT_CLEARABLE = false;
const DEFAULT_MULTIPLE = false;
const DEFAULT_SEARCH = false;
const DEFAULT_ALLOW_ADDITIONS = false;
const DEFAULT_CLASS_NAME = 'mb4';
const DEFAULT_ADDITION_LABEL = <i style={{ color: 'red' }}>Custom Value: </i>;

class DropDown extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.optionsInState = [];
    });
  }

  onAddItem = (e, data = {}) => {
    // Append the item to options that just got added
    this.optionsInState = _.concat({ text: data.value, value: data.value }, this.optionsInState);
  };

  render() {
    const {
      field,
      selection,
      fluid,
      disabled,
      clearable,
      multiple,
      search,
      allowAdditions,
      additionLabel,
      className,
      options = [],
      onChange,
      dataTestId,
    } = this.props;

    const { id, value, sync, placeholder, error = '' } = field;
    const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError

    const extra = field.extra || {};
    extra.options = extra.options || [];

    const mergeOptions = _.uniq([...this.optionsInState, ...extra.options, ...options]);

    const isDisabled = field.disabled || disabled;
    const disabledClass = isDisabled ? 'disabled' : '';
    const errorClass = hasError ? 'error' : '';

    /**
     * A utility function to see if the given component attribute is passed as an argument when rendering this component
     * or specified in the "extra" object.
     * The function returns the attribute value in the following order of precedence
     * 1. attribute value directly specified at the time of rendering the component (i.e., passed to the component), if the attribute was not passed then
     * 2. attribute value specified in the "extra" object of the given field, if it was not passed in the extra object as well then
     * 3. default attribute value
     *
     * @param attribName The name of the attribute
     * @param attribValue The attribute value that was passed when rendering the component
     * @param defaultAttribValue The default attribute value to use
     * @returns {*}
     */
    const getValue = (attribName, attribValue, defaultAttribValue) => {
      const fromExtra = extra && extra[attribName];
      // use specified attribValue if it is passed. If not, then try to use attrib value from the "extra" object
      let toUse = _.isNil(attribValue) ? fromExtra : attribValue;

      // if the attrib is neither passed nor in extra then use default value
      if (_.isNil(toUse)) {
        toUse = defaultAttribValue;
      }
      return toUse;
    };

    const attrs = {
      id,
      value,

      // applicable only when allowAdditions = true
      onAddItem: this.onAddItem,
      onChange: (e, data = {}) => {
        sync(data.value);
        field.validate({ showErrors: true });
        if (onChange) onChange(data.value, field);
      },
      placeholder,
      selection: getValue('selection', selection, DEFAULT_SELECTION),
      clearable: getValue('clearable', clearable, DEFAULT_CLEARABLE),
      multiple: getValue('multiple', multiple, DEFAULT_MULTIPLE),
      search: getValue('search', search, DEFAULT_SEARCH),
      fluid: getValue('fluid', fluid, DEFAULT_FLUID),
      allowAdditions: getValue('allowAdditions', allowAdditions, DEFAULT_ALLOW_ADDITIONS),
      disabled: getValue('disabled', isDisabled, DEFAULT_DISABLED),
      additionLabel: getValue('additionLabel', additionLabel, DEFAULT_ADDITION_LABEL),
      error: hasError,
    };

    return (
      <div className={c(getValue('className', className, DEFAULT_CLASS_NAME), errorClass, disabledClass)}>
        <Header field={field} />
        <Description field={field} />
        <Dropdown data-testid={dataTestId} className="field" options={mergeOptions} {...attrs} />
        <ErrorPointer field={field} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DropDown, {
  optionsInState: observable,
  onAddItem: action,
});

export default observer(DropDown);
