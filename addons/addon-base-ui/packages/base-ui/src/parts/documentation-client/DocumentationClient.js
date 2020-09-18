import React, { Component } from 'react';
import { decorate, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { Button, Embed, Label, Loader, Popup } from 'semantic-ui-react';

import { isLocalDev, docsUrl } from '../../helpers/settings';

// expected props
// urlSuffix (via props) - URL suffix for the documentation site
class DocumentationClient extends Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.isOpen = false;
      this.isFrameLoaded = false;
    });
  }

  handleToggle = () => {
    runInAction(() => {
      this.isFrameLoaded = false;
      this.isOpen = !this.isOpen;
    });
  };

  onFrameLoaded = () => {
    runInAction(() => {
      this.isFrameLoaded = true;
    });
  };

  render() {
    const { urlSuffix } = this.props;
    let iframeUrl;
    if (isLocalDev) {
      iframeUrl = `${docsUrl}/${urlSuffix}/index.html`;
    } else {
      iframeUrl = `${docsUrl}/${urlSuffix}`;
    }

    return (
      <div
        style={{
          width: '70px',
          height: '70px',
          position: 'fixed',
          right: '25px',
          bottom: '25px',
        }}
      >
        <Popup
          position="top right"
          style={{
            borderColor: '#2185d0',
            borderRadius: '5px',
            padding: 0,
            width: '400px',
          }}
          open={this.isOpen}
          on="click"
          size="huge"
          wide="very"
          trigger={
            <Button
              circular
              icon={this.isOpen ? 'close' : 'help'}
              size="huge"
              color={this.isOpen ? 'grey' : 'blue'}
              onClick={this.handleToggle}
            />
          }
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Label attached="top" color="blue" size="huge">
              Help
              <a
                href={iframeUrl}
                style={{ position: 'absolute', marginLeft: '10px', marginTop: '3px', fontSize: '16px' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                (click to open in new tab)
              </a>
            </Label>
            <Loader
              style={{
                display: 'inline-block',
                visibility: this.isFrameLoaded ? 'hidden' : 'visibile',
                position: 'absolute',
                left: '50%',
                bottom: '50%',
                transform: 'translate(-50%, 45%)',
                height: '100%',
                width: '100%',
              }}
              active
              size="big"
              inline="centered"
            />
            <Embed
              defaultActive
              style={{
                flexGrow: '1',
                backgroundColor: 'transparent',
                marginTop: '50px',
                height: '500px',
              }}
              iframe={{
                onLoad: this.onFrameLoaded,
                onError: this.onFrameLoaded,
                scrolling: 'auto',
                style: {
                  visibility: this.isFrameLoaded ? 'visible' : 'hidden',
                },
              }}
              url={iframeUrl}
            />
          </div>
        </Popup>
      </div>
    );
  }
}

decorate(DocumentationClient, {
  isOpen: observable,
  isFrameLoaded: observable,
});

export default observer(DocumentationClient);
