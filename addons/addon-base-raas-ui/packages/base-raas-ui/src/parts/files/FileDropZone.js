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
import { decorate, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';

import { Segment, Header, Divider, Button, Icon } from 'semantic-ui-react';
import uuidv4 from 'uuid/v4';
import { displayWarning } from '@amzn/base-ui/dist/helpers/notification';

/**
 * A reusable file input component.
 * Motivation: <input type="file" /> components are stateful and behave unexpectedly
 * when attempting to reuse them to upload multiple files.
 */
const ReusableFileInput = React.forwardRef(({ onChange, ...props }, ref) => {
  const [inputKey, setInputKey] = React.useState(uuidv4());
  return (
    <input
      key={inputKey}
      ref={ref}
      type="file"
      onChange={event => {
        onChange(event);
        setInputKey(uuidv4());
      }}
      {...props}
    />
  );
});

class FileDropZone extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.highlighted = false;
    });
  }

  setHighlight(isHighlighted) {
    runInAction(() => {
      this.highlighted = isHighlighted;
    });
  }

  handleSelectingFiles = event => {
    if (this.props.onSelectFiles) {
      const fileList = event.currentTarget.files || [];
      if (fileList.length > this.props.maximumUploadFilesLimit) {
        displayWarning(
          `There are currently ${fileList.length} files selected. Please select less than ${this.props.maximumUploadFilesLimit} files.`,
        );
      } else {
        this.props.onSelectFiles([...fileList]);
      }
    }
  };

  render() {
    const fileInputRef = React.createRef();
    const folderInputRef = React.createRef();
    const enabled = this.props.state === 'PENDING';
    return (
      <Segment
        tertiary={this.highlighted}
        placeholder
        onDragEnter={event => {
          if (enabled) {
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault();
              this.setHighlight(true);
            }
          }
        }}
        onDragOver={event => {
          if (enabled) {
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault();
              this.setHighlight(true);
            }
          }
        }}
        onDragLeave={() => {
          this.setHighlight(false);
        }}
        onDragEnd={() => {
          this.setHighlight(false);
        }}
        onDrop={event => {
          if (enabled) {
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault();
              this.setHighlight(false);
              const fileList = event.dataTransfer.files || [];
              this.props.onSelectFiles([...fileList]);
            }
          }
        }}
      >
        <Header icon color="grey">
          <ReusableFileInput
            ref={fileInputRef}
            hidden
            multiple
            onChange={event => {
              this.handleSelectingFiles(event);
            }}
          />
          <ReusableFileInput
            ref={folderInputRef}
            hidden
            multiple
            directory=""
            webkitdirectory=""
            onChange={event => {
              this.handleSelectingFiles(event);
            }}
          />
          {this.props.state === 'PENDING' ? (
            <>
              <Icon name="upload" className="mb2" />
              Drag and drop files
              <Divider horizontal>Or</Divider>
              <Button
                basic
                color="blue"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
              >
                Upload Files
              </Button>
              <Divider horizontal>Or</Divider>
              <Button
                basic
                color="blue"
                onClick={() => {
                  if (folderInputRef.current) {
                    folderInputRef.current.click();
                  }
                }}
              >
                Upload Folder
              </Button>
            </>
          ) : this.props.state === 'UPLOADING' ? (
            <>
              <Icon loading name="circle notch" className="mb2" />
              Uploading
            </>
          ) : this.props.state === 'COMPLETE' ? (
            <>
              <Icon name="check" className="mb2" />
              Upload Complete
            </>
          ) : null}
        </Header>
      </Segment>
    );
  }
}
FileDropZone.propTypes = {
  maximumUploadFilesLimit: PropTypes.isRequired,
  state: PropTypes.oneOf(['PENDING', 'UPLOADING', 'COMPLETE']).isRequired,
  onSelectFiles: PropTypes.func,
};
FileDropZone.defaultProps = {
  onSelectFiles: null,
};

decorate(FileDropZone, {
  setHighlight: observable,
});
export default observer(FileDropZone);
