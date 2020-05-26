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

import React from 'react';
import { observer } from 'mobx-react';
import { Segment } from 'semantic-ui-react';
import ConfigTable from '@aws-ee/base-ui/dist/parts/configuration/ConfigTable';

import ConfigOverrideTable from './ConfigOverrideTable';

// expected props
// - model (via props) with two properties: configSummaryRows and configOverrideSummaryRows
// - message (via props), a message to display when both rows are empty
// - className (via props)
const Component = observer(({ model = {}, className = '', message = 'No configuration entries are available' }) => {
  const configRows = model.configSummaryRows || [];
  const hasConfigRows = configRows.length > 0;
  const configOverrideRows = model.configOverrideSummaryRows || [];
  const hasConfigOverrideRows = configOverrideRows.length > 0;
  const empty = !hasConfigRows && !hasConfigOverrideRows;

  return (
    <>
      {hasConfigRows && (
        <Segment padded>
          <ConfigTable rows={configRows} />
        </Segment>
      )}
      {hasConfigOverrideRows && (
        <Segment padded>
          <ConfigOverrideTable rows={configOverrideRows} />
        </Segment>
      )}
      {empty && <div className={`${className}`}>{message}</div>}
    </>
  );
});

export default Component;
