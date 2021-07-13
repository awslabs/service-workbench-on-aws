import _ from 'lodash';
import React from 'react';
import { decorate, action, runInAction, observable, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Table, Segment, Grid } from 'semantic-ui-react';

import CopyToClipboard from '../../helpers/CopyToClipboard';

// expected props
// destinationUrl (via props)
// keyName (via props)
// connectionId (via props)
// timeout (via props)
class ScEnvHttpConnectionExpanded extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // The count down value
      this.countDown = undefined;
      this.intervalId = undefined;
      this.expired = false;
    });
  }

  get destinationUrl() {
    return this.props.destinationUrl;
  }

  get timeout() {
    return this.props.timeout;
  }

  get keyName() {
    return this.props.keyName;
  }

  get connectionId() {
    return this.props.connectionId;
  }

  componentDidMount() {
    this.startCountDown();
  }

  componentWillUnmount() {
    this.clearInterval();
  }

  clearInterval() {
    if (!_.isUndefined(this.intervalId)) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.countDown = undefined;
    this.expired = false;
  }

  startCountDown = () => {
    if (!_.isUndefined(this.intervalId)) return;
    this.countDown = this.timeout;

    this.intervalId = setInterval(async () => {
      // eslint-disable-next-line consistent-return
      runInAction(() => {
        if (this.countDown <= 0) {
          this.clearInterval();
          this.expired = true;
          return;
        }
        this.countDown -= 1;
      });
    }, 1000);
  };

  render() {
    const connectionId = this.connectionId;

    return (
      <Table.Row key={connectionId} className="fadeIn animated">
        <Table.Cell colSpan="3" className="p3">
          <Grid columns={2} stackable>
            <Grid.Row stretched>
              <Grid.Column width={12}>{this.renderInfo()}</Grid.Column>
              <Grid.Column width={4}>
                <Segment className="flex items-center">
                  <div className="w-100 overflow-hidden">{this.renderCountDown()}</div>
                </Segment>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Table.Cell>
      </Table.Row>
    );
  }

  renderInfo() {
    const destinationUrl = this.destinationUrl;

    return (
      <>
        <div>
          Click on this icon to copy the workspace destination URL:
          <CopyToClipboard text={destinationUrl} />
        </div>
        <div>(You can come back to this page to copy the destination URL)</div>
      </>
    );
  }

  renderCountDown() {
    const countDown = this.countDown;
    const expired = this.expired;

    if (expired) {
      return <div className="center color-red">AppStream session has been opened in a new tab</div>;
    }

    return (
      <div className="center">
        <div className="mb1">
          Secure AppStream tab opens in <br /> <b>{countDown}</b> <br /> seconds
        </div>
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvHttpConnectionExpanded, {
  destinationUrl: computed,
  keyName: computed,
  connectionId: computed,
  intervalId: observable,
  countDown: observable,
  expired: observable,
  startCountDown: action,
  clearInterval: action,
});

export default inject()(withRouter(observer(ScEnvHttpConnectionExpanded)));
