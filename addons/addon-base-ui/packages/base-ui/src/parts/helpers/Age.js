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
import TimeAgo from 'react-timeago';

// expected props
// - date (via props)
// - emptyMessage (via props) (a message to display when the date is empty)
// - className (via props)
const Component = observer(({ date, className, emptyMessage = 'Not Provided' }) => {
  if (_.isEmpty(date)) return <span className={c(className)}>{emptyMessage}</span>;
  const formatter = (_value, _unit, _suffix, _epochSeconds, nextFormatter) =>
    (nextFormatter() || '').replace(/ago$/, 'old');
  return (
    <span className={c(className)}>
      <TimeAgo date={date} formatter={formatter} />
    </span>
  );
});

export default Component;
