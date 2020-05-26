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
import { Input } from 'semantic-ui-react';
import c from 'classnames';

import Header from './Header';
import Description from './Description';
import ErrorPointer from './ErrorPointer';

// expected props
// - field (via props), this is the mobx form field object
// - className (via props)
//
// The following props are to support existing React Semantic UI props:
// - fluid (via props), default to true
// - disabled (via props), default to false
// - autoFocus (via props), default to false
// - icon (via props)
// - iconPosition (via props)
const Component = observer(
  ({
    field,
    fluid = true,
    disabled = false,
    type = 'text',
    className = 'mb4',
    autoFocus = false,
    icon,
    iconPosition,
  }) => {
    const { error = '' } = field;
    const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError
    const isDisabled = field.disabled || disabled;
    const disabledClass = isDisabled ? 'disabled' : '';
    const errorClass = hasError ? 'error' : '';
    const attrs = {
      fluid,
      disabled: isDisabled,
      error: hasError,
      ..._.omit(field.bind(), ['label']),
      autoFocus,
      type,
      icon,
      iconPosition,
    };

    return (
      <div className={c(className, errorClass, disabledClass)}>
        <Header field={field} />
        <Description field={field} />
        <Input className="field" {...attrs} />
        <ErrorPointer field={field} />
      </div>
    );
  },
);

export default Component;
