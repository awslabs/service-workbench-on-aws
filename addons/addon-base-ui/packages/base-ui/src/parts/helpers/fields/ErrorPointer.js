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
import c from 'classnames';

// expected props
// - field (via props), this is the mobx form field object
const Component = observer(({ field, className }) => {
  const { error = '' } = field;
  const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError

  if (!hasError) return null;
  return <div className={c('ui pointing basic label', className)}>{error}</div>;
});

export default Component;
