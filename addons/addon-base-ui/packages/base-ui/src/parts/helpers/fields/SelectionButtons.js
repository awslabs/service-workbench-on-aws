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
import { Button } from 'semantic-ui-react';
import c from 'classnames';

import Header from './Header';
import Description from './Description';
import ErrorPointer from './ErrorPointer';

// expected props
// - field (via props), this is the mobx form field object
// - options (via props), an array of [ {text, value}, {text, value}, ...]
// - show (via props), can be 'headerOnly', 'buttonsOnly', 'both' (default to 'both')
// - className (via props)
// - onChange (via props), a call back function that receives (value, field)
//
// The following props are to support existing React Semantic UI props:
// - disabled (via props), default to false
// - size (via props), default to tiny
const Component = observer(
  ({ field, disabled = false, show = 'both', className = 'mb4', size = 'tiny', options = [], onChange }) => {
    const { id, value, sync, error = '', extra = {} } = field;
    const mergedOptions = [...((extra && extra.options) || []), ...options];

    const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError
    const isDisabled = field.disabled || disabled;
    const disabledClass = isDisabled ? 'disabled' : '';
    const errorClass = hasError ? 'error' : '';
    const handleClick = toAssign => event => {
      event.preventDefault();
      event.stopPropagation();
      if (isDisabled) return;
      sync(toAssign);
      field.validate({ showErrors: true });
      if (onChange) onChange(toAssign, field);
    };

    const headerOrHeaderAndButtons = show === 'both' || show === 'headerOnly';
    const headerOnly = show === 'headerOnly';
    const buttonsOnly = show === 'buttonsOnly';

    const buttons = (
      <Button.Group id={id} size={size}>
        {_.map(mergedOptions, option => (
          <Button
            key={option.value}
            onClick={handleClick(option.value)}
            disabled={isDisabled}
            basic={option.value !== value}
            color={hasError ? 'red' : 'blue'}
          >
            {option.text}
          </Button>
        ))}
      </Button.Group>
    );

    return (
      <div className={c(className, errorClass, disabledClass)}>
        {headerOrHeaderAndButtons && (
          <>
            <div className="flex flex-wrap mb1">
              <Header field={field} className="mt1 mb0 mr2" />
              {!headerOnly && (
                <div className="flex-auto">
                  <div>{buttons}</div>
                  <ErrorPointer field={field} />
                </div>
              )}
            </div>
            <Description field={field} />
          </>
        )}
        {buttonsOnly && buttons}
      </div>
    );
  },
);

export default Component;
