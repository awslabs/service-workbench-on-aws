import React from 'react';
import { decorate, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';

import { Segment, Header, Divider, Button, Icon } from 'semantic-ui-react';
import uuidv4 from 'uuid/v4';

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

  render() {
    const fileInputRef = React.createRef();
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
              if (this.props.onSelectFiles) {
                const fileList = event.currentTarget.files || [];
                this.props.onSelectFiles([...fileList]);
              }
            }}
          />
          {this.props.state === 'PENDING' ? (
            <>
              <Icon name="upload" className="mb2" />
              Drag and drop
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
                Browse Files
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
