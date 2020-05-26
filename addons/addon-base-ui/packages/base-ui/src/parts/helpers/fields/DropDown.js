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
const Component = observer(
  ({
    field,
    selection = false,
    fluid = false,
    disabled = false,
    clearable = false,
    multiple = false,
    search = false,
    className = 'mb4',
    options = [],
    onChange,
  }) => {
    const { id, value, sync, placeholder, error = '', extra = {} } = field;
    const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError
    const mergeOptions = [...((extra && extra.options) || []), ...options];
    const isDisabled = field.disabled || disabled;
    const disabledClass = isDisabled ? 'disabled' : '';
    const errorClass = hasError ? 'error' : '';
    const attrs = {
      id,
      value,
      onChange: (e, data = {}) => {
        sync(data.value);
        field.validate({ showErrors: true });
        if (onChange) onChange(data.value, field);
      },
      placeholder,
      selection,
      clearable,
      multiple,
      search,
      fluid,
      disabled: isDisabled,
      error: hasError,
    };

    return (
      <div className={c(className, errorClass, disabledClass)}>
        <Header field={field} />
        <Description field={field} />
        <Dropdown className="field" options={mergeOptions} {...attrs} />
        <ErrorPointer field={field} />
      </div>
    );
  },
);

export default Component;
