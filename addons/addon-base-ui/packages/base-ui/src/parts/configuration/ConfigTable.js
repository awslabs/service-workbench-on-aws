import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import { Table } from 'semantic-ui-react';

// expected props
// - rows (via props), an array of objects, [ { name, title, value }, { name, title, value }, ... ]
// - className (via props)
const Component = observer(({ rows = [], className = '' }) => {
  if (rows.length === 0) return null;

  return (
    <Table basic="very" className={`animated fadeIn ${className}`}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={10}>Key</Table.HeaderCell>
          <Table.HeaderCell width={6}>Value</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {_.map(rows, (item, index) => (
          <Table.Row key={index}>
            <Table.Cell width={10}>{renderKey(item)}</Table.Cell>
            <Table.Cell width={6}>{renderValue(item)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
});

function renderValue({ value }) {
  const isNil = _.isNil(value);
  const isEmpty = _.isString(value) && _.isEmpty(value);
  return isNil || isEmpty ? 'Not Provided' : value.toString();
}

function renderKey({ title = '', name }) {
  const hasTitle = !_.isEmpty(title);

  if (hasTitle) {
    return (
      <>
        <div>{title}</div>
        <div className="fs-7 color-grey">{name}</div>
      </>
    );
  }
  return <div>{name}</div>;
}

export default Component;
