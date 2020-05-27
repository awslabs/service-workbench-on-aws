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

/* eslint-disable react/no-danger */
import React from 'react';
import { observer } from 'mobx-react';
import c from 'classnames';
import { Message } from 'semantic-ui-react';

// expected props
// - field (via props), this is the mobx form field object
const Component = observer(({ field }) => {
  const { extra = {} } = field;
  const explain = (extra || {}).explain;
  const warn = (extra || {}).warn;
  const hasExplain = !!explain;
  const hasWarn = !!warn;

  return (
    <>
      {hasExplain && <div className={c('field', 'mb2')} dangerouslySetInnerHTML={{ __html: explain }} />}
      {hasWarn && (
        <Message className="field" color="brown">
          <b className="mr1">Warning</b>
          {warn}
        </Message>
      )}
    </>
  );
});

export default Component;
