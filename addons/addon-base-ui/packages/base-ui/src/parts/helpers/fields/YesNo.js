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
// - form (via props)
// - field (via props), this is the mobx form field object
// - className (via props)
//
// The following props are to support existing React Semantic UI props:
// - disabled (via props), default to false
// - size (via props), default to small
const Component = observer(
  ({ field, disabled = false, size = 'small', className = 'mb4', onClick, disabledLabel = '' }) => {
    const { id, value, sync, error = '', extra = {} } = field;
    const { yesLabel = 'Yes', noLabel = 'No', yesValue = true, noValue = false, showHeader = true } = extra;
    const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError
    const isDisabled = field.disabled || disabled;
    const yesDisabled = disabledLabel.toUpperCase() === 'YES';
    const noDisabled = disabledLabel.toUpperCase() === 'NO';
    const disabledClass = isDisabled ? 'disabled' : '';
    const errorClass = hasError ? 'error' : '';
    const yesSelected = value === yesValue;
    const noSelected = value === noValue;
    const handleClick = toAssign => event => {
      event.preventDefault();
      event.stopPropagation();
      sync(toAssign);
      field.validate({ showErrors: true });
      if (onClick) onClick(toAssign, field);
    };

    const yesAttributes = {
      onClick: handleClick(yesValue),
      disabled: isDisabled || yesDisabled,
    };
    const noAttributes = {
      onClick: handleClick(noValue),
      disabled: isDisabled || noDisabled,
    };

    if (yesSelected) yesAttributes.color = 'teal';
    if (noSelected) noAttributes.color = 'teal';

    return (
      <div className={c(className, errorClass, disabledClass)}>
        <div className="flex flex-wrap mb1">
          {showHeader && <Header field={field} className="mt1 mb0 mr2" />}
          <div>
            <Button.Group id={id} size={size}>
              <Button {...yesAttributes}>{yesLabel}</Button>
              <Button.Or />
              <Button {...noAttributes}>{noLabel}</Button>
            </Button.Group>
          </div>
        </div>
        <Description field={field} />
        <ErrorPointer field={field} />
      </div>
    );
  },
);

export default Component;
