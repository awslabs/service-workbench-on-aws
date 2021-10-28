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
import _ from 'lodash';
import { observer } from 'mobx-react';
import { action, decorate, observable, runInAction } from 'mobx';
import { Button, Icon, Table } from 'semantic-ui-react';

import EditableNameValueRow from './EditableNameValueRow';

// expected props
// - field (via props) -- this is the mobx form field object. The field's value is a JSON string representation
//   of the object in shape [{key,value}]
// - nameHeader (via props) -- (optional) The label to display for the name column
// - valueHeader (via props) -- (optional) The label to display for the value column
// - actionHeader (via props) -- (optional) The label to display for the action column
// - onEnterEditMode -- (optional) function to notify when row enters edit mode.
//                      The function is passed the "rowKey" that is entering the edit mode.
// - onExitEditMode -- (optional) function to notify when row exists edit mode. (due to clicking cancel or save).
//                      The function is passed the "rowKey" that is entering the edit mode.
class NameValuesEditor extends React.Component {
  componentDidMount() {
    runInAction(() => {
      // The value of this field as string
      this.value = this.props.field.value || '[]';

      // An array containing {key, value} or { name, value } objects
      const fromKeyValueToNameValue = keyValue => {
        const name = keyValue.key || keyValue.name;
        return { name, value: keyValue.value };
      };

      // This object's JSON string representation is used as the value for this field.
      const keyValues = JSON.parse(this.value || '[]') || [];
      this.nameValues = _.map(keyValues, fromKeyValueToNameValue);

      this.shouldShowAddRowButton = true;
      this.shouldShowCreateRow = false;
    });
  }

  render() {
    const nameHeader = _.isNil(this.props.nameHeader) ? 'Name' : this.props.nameHeader;
    const valueHeader = _.isNil(this.props.valueHeader) ? 'Value' : this.props.valueHeader;
    const actionHeader = _.isNil(this.props.actionHeader) ? 'Action' : this.props.actionHeader;

    const rows = _.map(this.nameValues, ({ name, value }, rowIdx) => this.renderNameValueLine({ rowIdx, name, value }));

    if (this.shouldShowCreateRow) {
      const rowIdx = this.nameValues.length;
      rows.push(
        <EditableNameValueRow
          key={rowIdx}
          name=""
          value=""
          editorOn
          onSubmit={form => {
            this.handleNameValueChange({ rowIdx, nameValueForm: form });
          }}
          onDelete={this.hideCreateRow}
          onEnterEditMode={this.onEnterEditMode}
          onExitEditMode={this.onExitEditMode}
        />,
      );
    }
    if (_.isEmpty(rows)) {
      const emptyMessage = _.isFunction(this.props.emptyRenderer) ? (
        this.props.emptyRenderer()
      ) : (
        <Table.Row key="empty-row">
          <Table.Cell colSpan={3}>No name/value pairs. Click + to add one.</Table.Cell>
        </Table.Row>
      );
      rows.push(emptyMessage);
    }
    return (
      <Table celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{nameHeader}</Table.HeaderCell>
            <Table.HeaderCell>{valueHeader}</Table.HeaderCell>
            <Table.HeaderCell width={2}>{actionHeader}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>{rows}</Table.Body>
        <Table.Footer fullWidth>
          <Table.Row>
            {this.shouldShowAddRowButton && (
              <Table.HeaderCell colSpan="3">
                <Button icon color="blue" size="tiny" className="ml1" onClick={this.showCreateRow}>
                  <Icon name="plus" />
                </Button>
              </Table.HeaderCell>
            )}
            {!this.shouldShowAddRowButton && <Table.HeaderCell colSpan="3" className="pb3" />}
          </Table.Row>
        </Table.Footer>
      </Table>
    );
  }

  renderNameValueLine({ rowIdx, name, value }) {
    return (
      <EditableNameValueRow
        key={rowIdx}
        rowKey={rowIdx}
        name={name}
        value={value}
        onSubmit={form => this.handleNameValueChange({ rowIdx, nameValueForm: form })}
        onDelete={() => this.handleNameValueDelete({ rowIdx })}
        onEnterEditMode={this.onEnterEditMode}
        onExitEditMode={this.onExitEditMode}
      />
    );
  }

  onEnterEditMode = rowKey => {
    this.hideShowAddRowButton();
    const onEnterEditMode = this.props.onEnterEditMode;
    if (onEnterEditMode) {
      onEnterEditMode(rowKey);
    }
  };

  onExitEditMode = rowKey => {
    this.showAddRowButton();
    const onExitEditMode = this.props.onExitEditMode;
    if (onExitEditMode) {
      onExitEditMode(rowKey);
    }
  };

  handleNameValueChange = ({ rowIdx, nameValueForm }) => {
    const nameField = nameValueForm.$('name');
    const valueField = nameValueForm.$('value');
    this.nameValues[rowIdx] = { name: nameField.value, value: valueField.value };
    this.syncField();
    this.showAddRowButton();
  };

  handleNameValueDelete = ({ rowIdx }) => {
    this.nameValues.splice(rowIdx, 1);
    this.syncField();
  };

  hideShowAddRowButton = () => {
    this.shouldShowAddRowButton = false;
  };

  showAddRowButton = () => {
    this.shouldShowAddRowButton = true;
    this.hideCreateRow();
  };

  hideCreateRow = () => {
    this.shouldShowCreateRow = false;
  };

  showCreateRow = () => {
    this.shouldShowCreateRow = true;
    this.hideShowAddRowButton();
  };

  syncField = () => {
    // The nameValues is the JavaScript object representation of the specified field
    // so convert it to value by stringifying it and then sync the given form field value
    this.value = JSON.stringify(this.nameValues);
    const sync = this.props.field.sync;
    sync(this.value);
  };
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(NameValuesEditor, {
  nameValues: observable,
  shouldShowAddRowButton: observable,
  shouldShowCreateRow: observable,

  hideShowAddRowButton: action,
  showAddRowButton: action,
  hideCreateRow: action,
  showCreateRow: action,

  handleNameValueChange: action,
  handleNameValueDelete: action,
});

export default observer(NameValuesEditor);
