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
import { action, runInAction } from 'mobx';
import { Icon, Table } from 'semantic-ui-react';
import { observer } from 'mobx-react';
import _ from 'lodash';
import { getNameValueForm } from '../../../models/forms/NameValueForm';
import EditableField from './EditableField';
import Input from './Input';

// expected props
// - rowKey (via props) -- The key to identify this row
// - name (via props) -- The name in the { name, value } pair
// - value (via props) -- The value in the { name, value } pair
// - editorOn (via props) -- Flag indicating if the row should be displayed in
//                            edit more or view mode (true - edit mode, false - view mode)
// - onSubmit (via props) -- Function to call when save is clicked on the row
// - onCancel (via props) -- Function to call when cancel is clicked on the row
// - onDelete (via props) -- Function to call when delete is clicked on the row
// - onEnterEditMode -- (optional) function to notify when row enters edit mode.
//                      The function is passed the "rowKey" that is entering the edit mode.
// - onExitEditMode -- (optional) function to notify when row exists edit mode. (due to clicking cancel or save).
//                      The function is passed the "rowKey" that is entering the edit mode.
class EditableNameValueRow extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getNameValueForm({ name: props.name, value: props.value });
      if (props.editorOn) {
        this.handleEditClick();
      }
    });
  }

  render() {
    const form = this.form;
    const nameField = form.$('name');
    const valueField = form.$('value');
    const onDelete = this.props.onDelete;

    return (
      <EditableField
        form={form}
        showDimmer={false}
        showErrorPanel={false}
        renderFormAs={
          // Do not want the EditableField to render a "form" tag so rendering
          // the content of the form as is without the "form".
          // This is done because the row is rendered inside table.body
          // rendering form directly in the table body is invalid structure
          formContent => <>{formContent}</>
        }
        editorOn={this.props.editorOn}
        onSubmit={this.handleSubmit}
        onCancel={this.handleCancel}
        renderFieldForView={({ onEditorOn: onClickEdit }) => (
          <Table.Row>
            <Table.Cell>{this.props.name}</Table.Cell>
            <Table.Cell>{this.props.value}</Table.Cell>
            <Table.Cell>
              <Icon
                name="pencil"
                className="ml1 cursor-pointer"
                color="grey"
                onClick={() => {
                  onClickEdit();
                  this.handleEditClick(this.props.rowKey);
                }}
              />
              <Icon name="trash" className="ml1 cursor-pointer" color="grey" onClick={onDelete} />
            </Table.Cell>
          </Table.Row>
        )}
        renderFieldForEdit={({ processing, onSubmit: submit, onCancel }) => (
          <Table.Row>
            <Table.Cell>
              <Input field={nameField} className="mb0" showHeader={false} disabled={processing} />
            </Table.Cell>
            <Table.Cell>
              <Input field={valueField} className="mb0" showHeader={false} disabled={processing} />
            </Table.Cell>
            <Table.Cell>
              <Icon name="close" className="ml1 cursor-pointer" color="grey" onClick={onCancel} />
              <Icon name="check" className="ml1 cursor-pointer" color="grey" onClick={submit} />
            </Table.Cell>
          </Table.Row>
        )}
      />
    );
  }

  handleEditClick = action(async key => {
    await this.notifyHandler(this.props.onEnterEditMode, key);
  });

  handleSubmit = action(async form => {
    await this.notifyHandler(this.props.onExitEditMode, this.props.rowKey);
    await this.notifyHandler(this.props.onSubmit, form);
    runInAction(() => {
      this.form = getNameValueForm({ name: this.props.name, value: this.props.value });
    });
  });

  handleCancel = action(async form => {
    await this.notifyHandler(this.props.onExitEditMode, this.props.rowKey);
    await this.notifyHandler(this.props.onCancel, form);
    runInAction(() => {
      this.form = getNameValueForm({ name: this.props.name, value: this.props.value });
    });
  });

  notifyHandler = async (handlerFn, ...args) => {
    const handlerFnToNotify = handlerFn || _.noop;
    await handlerFnToNotify(...args);
  };
}
export default observer(EditableNameValueRow);
