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
