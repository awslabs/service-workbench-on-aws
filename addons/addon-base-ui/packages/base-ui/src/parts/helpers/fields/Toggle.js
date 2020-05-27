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
import { Icon } from 'semantic-ui-react';
import c from 'classnames';

import Header from './Header';
import Description from './Description';
import ErrorPointer from './ErrorPointer';

// expected props
// - form (via props)
// - field (via props), this is the mobx form field object
// - show (via props), can be 'headerOnly', 'toggleOnly', 'both' (default to 'both')
// - className (via props)
//
// The following props are to support existing React Semantic UI props:
// - disabled (via props), default to false
// - size (via props), default to large
const Component = observer(({ field, disabled = false, show = 'both', className = 'mb4', size = 'large' }) => {
  const { id, value, sync, error = '', extra = {} } = field;
  const { yesLabel = 'Yes', noLabel = 'No' } = extra || {};
  const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError
  const isDisabled = field.disabled || disabled;
  const disabledClass = isDisabled ? 'disabled' : '';
  const errorClass = hasError ? 'error' : '';
  const yesSelected = (_.isBoolean(value) && value === true) || value === 'true';
  const cursor = isDisabled ? 'op-3' : 'cursor-pointer';
  const handleClick = toAssign => event => {
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled) return;
    sync(toAssign);
    field.validate({ showErrors: true });
  };

  const yesAttributes = {
    name: 'toggle on',
    color: hasError ? 'red' : 'blue',
    size,
    className: 'mr1',
    disabled: isDisabled,
  };
  const noAttributes = {
    name: 'toggle off',
    color: hasError ? 'red' : 'grey',
    size,
    className: 'mr1',
    disabled: isDisabled,
  };

  const headerOrHeaderAndToggle = show === 'both' || show === 'headerOnly';
  const headerOnly = show === 'headerOnly';
  const toggleOnly = show === 'toggleOnly';

  const toggleButton = (
    <div className={c(hasError ? 'color-red' : '')}>
      {yesSelected && (
        <span id={id} className={c(cursor)} onClick={handleClick(false)}>
          <Icon {...yesAttributes} />
          {yesLabel}
        </span>
      )}
      {!yesSelected && (
        <span id={id} className={c('op-65', cursor)} onClick={handleClick(true)}>
          <Icon {...noAttributes} />
          {noLabel}
        </span>
      )}
    </div>
  );

  return (
    <div className={c(className, errorClass, disabledClass)}>
      {headerOrHeaderAndToggle && (
        <>
          <div className="flex flex-wrap mb1">
            <Header field={field} className="mt0 mb0 mr2" />
            {!headerOnly && toggleButton}
          </div>
          <Description field={field} />
          <ErrorPointer field={field} />
        </>
      )}
      {toggleOnly && toggleButton}
    </div>
  );
});

export default Component;
