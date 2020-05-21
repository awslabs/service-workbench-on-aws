import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import { Table } from 'semantic-ui-react';

// expected props
// - rows (via props), an array of objects, [ { title, value }, { title, value }, ... ]
// - className (via props)
const Component = observer(({ rows = [], className = '' }) => {
  if (rows.length === 0) return null;

  return (
    <Table basic="very" className={`animated ${className}`}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={10}>Property</Table.HeaderCell>
          <Table.HeaderCell width={6}>Value</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {_.map(rows, (item, index) => (
          <Table.Row key={index}>
            <Table.Cell width={10}>{item.title}</Table.Cell>
            <Table.Cell width={6}>{convert(item.value)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
});

function convert(value) {
  return _.isNil(value) ? 'Not Provided' : value.toString();
}

export default Component;
