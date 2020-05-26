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

import PropertyTable from './PropertyTable';
import PropertyOverrideTable from './PropertyOverrideTable';

// expected props
// - model (via props) with two properties: propertySummaryRows and propertyOverrideSummaryRows
// - message (via props), a message to display when both rows are empty
// - className (via props)
const Component = observer(({ model = {}, className = '', message = 'No properties are available' }) => {
  const propertyRows = model.propertySummaryRows || [];
  const hasPropertyRows = propertyRows.length > 0;
  const propertyOverrideRows = model.propertyOverrideSummaryRows || [];
  const hasPropertyOverrideRows = propertyOverrideRows.length > 0;
  const empty = !hasPropertyRows && !hasPropertyOverrideRows;

  return (
    <>
      {hasPropertyRows && (
        <Segment padded>
          <PropertyTable rows={propertyRows} />
        </Segment>
      )}
      {hasPropertyOverrideRows && (
        <Segment padded>
          <PropertyOverrideTable rows={propertyOverrideRows} />
        </Segment>
      )}
      {empty && <div className={`${className}`}>{message}</div>}
    </>
  );
});

export default Component;
