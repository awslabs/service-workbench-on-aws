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
