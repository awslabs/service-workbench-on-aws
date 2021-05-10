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
import prettyBytes from 'pretty-bytes';
import { observer } from 'mobx-react';
import { Button, Icon, Progress, Table } from 'semantic-ui-react';

const FileUploadStatus = observer(({ file }) =>
  file.status === 'PENDING' ? (
    'Pending'
  ) : file.status === 'UPLOADING' ? (
    <Progress
      size="small"
      className="mb0"
      indicating
      autoSuccess
      progress
      percent={Math.floor((file.uploaded / file.size) * 100)}
    />
  ) : file.status === 'FAILED' ? (
    <>
      <Icon name="times" color="red" /> {`${file.error || 'Error'}`}
    </>
  ) : file.status === 'COMPLETE' ? (
    <>
      <Icon name="check" color="green" /> Complete
    </>
  ) : (
    'Unknown'
  ),
);

const FileUploadToolbar = observer(({ file, state, onClickRemove, onClickCancel }) =>
  file.status === 'PENDING' ? (
    <Button
      floated="right"
      icon="trash"
      size="tiny"
      basic
      color="grey"
      onClick={onClickRemove}
      disabled={state !== 'PENDING'}
    />
  ) : file.status === 'UPLOADING' ? (
    <Button floated="right" icon="remove" size="tiny" basic color="red" onClick={onClickCancel} />
  ) : null,
);

const FileUploadRow = observer(({ file, state, onClickRemove, onClickCancel }) => (
  <Table.Row>
    <Table.Cell>{file.folder}</Table.Cell>
    <Table.Cell>{file.name}</Table.Cell>
    <Table.Cell>{prettyBytes(file.size)}</Table.Cell>
    <Table.Cell>
      <FileUploadStatus file={file} />
    </Table.Cell>
    <Table.Cell>
      <FileUploadToolbar file={file} state={state} onClickRemove={onClickRemove} onClickCancel={onClickCancel} />
    </Table.Cell>
  </Table.Row>
));

const FileUploadTable = observer(({ files = [], state, onClickRemoveFile, onClickCancelFile }) => (
  <Table basic="very">
    <Table.Header>
      <Table.Row>
        <Table.HeaderCell>Folder</Table.HeaderCell>
        <Table.HeaderCell>Filename</Table.HeaderCell>
        <Table.HeaderCell>Size</Table.HeaderCell>
        <Table.HeaderCell>Status</Table.HeaderCell>
        <Table.HeaderCell />
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {files.map(file => (
        <FileUploadRow
          key={file.id}
          file={file}
          state={state}
          onClickRemove={() => onClickRemoveFile(file.id)}
          onClickCancel={() => onClickCancelFile(file.id)}
        />
      ))}
    </Table.Body>
  </Table>
));

export default FileUploadTable;
