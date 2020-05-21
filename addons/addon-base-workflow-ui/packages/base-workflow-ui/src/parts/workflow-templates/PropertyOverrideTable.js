import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import { Table, Icon } from 'semantic-ui-react';
import c from 'classnames';
import Toggle from '@aws-ee/base-ui/dist/parts/helpers/fields/Toggle';

// expected props
// - rows (via props), an array of objects, [ { name, title, allowed }, { name, title, allowed }, ... ], if editable = false
//                     otherwise the array is expected to be an array of mobx form fields instances
// - editable (via props), is this a toggle table?
// - className (via props)
const Component = observer(({ rows = [], className = '', editable = false, processing = false }) => {
  if (rows.length === 0) return null;
  const getTitle = item => (editable ? item.label : item.title);

  return (
    <Table basic="very" className={c('animated', className)}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={10}>Property</Table.HeaderCell>
          <Table.HeaderCell width={6}>Can be changed?</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {_.map(rows, (item, index) => (
          <Table.Row key={`${index}-${getTitle(item)}`}>
            <Table.Cell>{getTitle(item)}</Table.Cell>
            <Table.Cell>
              {!editable && convert(item.allowed)}
              {editable && <Toggle field={item} disabled={processing} show="toggleOnly" className="mb0" />}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
});

function convert(allowed) {
  if (allowed)
    return (
      <span className="op-3">
        <Icon name="toggle on" color="blue" size="large" className="mr1" />
        Yes
      </span>
    );
  return (
    <span className="op-3">
      <Icon name="toggle off" size="large" color="grey" className="mr1" />
      No
    </span>
  );
}

export default Component;
