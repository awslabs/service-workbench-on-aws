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

import { decorate, observable, runInAction } from 'mobx';
import { inject, observer, PropTypes as MobXPropTypes } from 'mobx-react';
import PropTypes from 'prop-types';

import React from 'react';
import { Button, Grid, Header, Segment } from 'semantic-ui-react';

import { displayError, displaySuccess, displayWarning } from '@amzn/base-ui/dist/helpers/notification';

import StudyFileDropZone from './FileDropZone';
import FileUploadTable from './FileUploadTable';

const maximumUploadFilesLimit = 1000;
const FileUpload = observer(
  ({
    files = [],
    state = 'PENDING',
    onCancelSelectFiles,
    onCancelUpload,
    onClickStartUpload,
    onClickUploadMore,
    onSelectFiles,
    onClickRemoveFile,
    onClickCancelFile,
  }) => {
    return (
      <Segment vertical>
        <Header as="h3">Upload Files</Header>
        <StudyFileDropZone
          state={state}
          onSelectFiles={onSelectFiles}
          maximumUploadFilesLimit={maximumUploadFilesLimit}
        />
        {files.length > 0 && (
          <Segment>
            <Grid>
              <Grid.Row>
                <Grid.Column>
                  <FileUploadTable
                    files={files}
                    state={state}
                    onClickRemoveFile={onClickRemoveFile}
                    onClickCancelFile={onClickCancelFile}
                  />
                </Grid.Column>
              </Grid.Row>
              <Grid.Row>
                <Grid.Column>
                  {state === 'PENDING' ? (
                    <Button
                      floated="right"
                      basic
                      color="blue"
                      onClick={() => {
                        if (files.length > maximumUploadFilesLimit) {
                          displayWarning(
                            `There are currently ${files.length} files selected. Please select less than ${maximumUploadFilesLimit} files.`,
                          );
                        } else {
                          onClickStartUpload();
                        }
                      }}
                    >
                      Upload Files
                    </Button>
                  ) : state === 'UPLOADING' ? (
                    <Button floated="right" basic color="blue" loading disabled>
                      Uploading
                    </Button>
                  ) : state === 'COMPLETE' ? (
                    <Button floated="right" basic color="blue" onClick={onClickUploadMore}>
                      Upload More Files
                    </Button>
                  ) : null}
                  {state === 'PENDING' ? (
                    <Button floated="right" basic onClick={onCancelSelectFiles}>
                      Cancel
                    </Button>
                  ) : state === 'UPLOADING' ? (
                    <Button floated="right" basic onClick={onCancelUpload}>
                      Cancel
                    </Button>
                  ) : null}
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Segment>
        )}
      </Segment>
    );
  },
);
FileUpload.propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired,
      status: PropTypes.oneOf(['PENDING', 'UPLOADING', 'COMPLETE', 'FAILED']).isRequired,
      uploaded: PropTypes.number,
      error: PropTypes.string,
    }),
  ),
  state: PropTypes.oneOf(['PENDING', 'UPLOADING', 'COMPLETE']).isRequired,
  onCancelSelectFiles: PropTypes.func,
  onCancelUpload: PropTypes.func,
  onClickStartUpload: PropTypes.func,
  onClickUploadMore: PropTypes.func,
  onSelectFiles: PropTypes.func,
  onClickRemoveFile: PropTypes.func,
  onClickCancelFile: PropTypes.func,
};

class ConnectedFileUpload extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.fileUploadGroup = props.fileUploadsStore.getFileUploadGroup(this.props.resourceId);
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resourceId !== this.props.resourceId) {
      runInAction(() => {
        this.fileUploadGroup = this.props.fileUploadsStore.getFileUploadGroup(this.props.resourceId);
      });
    }
  }

  handleResetFileUploadGroup = () => {
    runInAction(() => {
      this.props.fileUploadsStore.resetFileUploadGroup(this.props.resourceId);
      this.fileUploadGroup = this.props.fileUploadsStore.getFileUploadGroup(this.props.resourceId);
    });
  };

  handleCancel = () => {
    this.fileUploadGroup.cancel();
  };

  handleStart = async () => {
    const group = this.fileUploadGroup;
    try {
      await group.start(this.props.fileUploadHandler);
      let success = 0;
      let errors = 0;
      group.fileUploadObjects.forEach(fileUpload => {
        // eslint-disable-next-line default-case
        switch (fileUpload.status) {
          case 'COMPLETE':
            success++;
            break;
          case 'FAILED':
            if (fileUpload.error !== 'Cancelled') {
              errors++;
            }
            break;
        }
      });
      if (errors > 0 && success > 0) {
        displayWarning(`File uploads completed with ${errors} errors`);
      } else if (errors > 0) {
        displayError(`File uploads failed`);
      } else if (success > 0) {
        displaySuccess(`File uploads completed successfully!`);
      }
    } catch (err) {
      displayError(`File uploads failed: ${err}`);
    }
  };

  handleCancelFileUpload = id => {
    const fileUpload = this.fileUploadGroup.getFileUpload(id);
    if (fileUpload) {
      fileUpload.doCancel();
    }
  };

  handleRemoveFileUpload = id => {
    this.fileUploadGroup.remove(id);
  };

  handleSelectFiles = files => {
    const group = this.fileUploadGroup;
    files.forEach(file => {
      group.add({ file });
    });
  };

  render() {
    return (
      <FileUpload
        files={this.fileUploadGroup.fileUploadObjects}
        state={this.fileUploadGroup.state}
        onCancelSelectFiles={this.handleResetFileUploadGroup}
        onCancelUpload={this.handleCancel}
        onClickStartUpload={this.handleStart}
        onClickUploadMore={this.handleResetFileUploadGroup}
        onSelectFiles={this.handleSelectFiles}
        onClickRemoveFile={this.handleRemoveFileUpload}
        onClickCancelFile={this.handleCancelFileUpload}
      />
    );
  }
}
ConnectedFileUpload.propTypes = {
  resourceId: PropTypes.string.isRequired,
  fileUploadHandler: PropTypes.func.isRequired,
  fileUploadsStore: MobXPropTypes.observableObject.isRequired,
};

decorate(ConnectedFileUpload, {
  fileUploadGroup: observable,
});
export default inject('fileUploadsStore')(observer(ConnectedFileUpload));
