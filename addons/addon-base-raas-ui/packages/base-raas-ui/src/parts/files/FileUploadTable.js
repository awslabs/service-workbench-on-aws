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
