import _ from 'lodash';
import React from 'react';
import { decorate, action, runInAction, observable, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Table, List, Segment, Label, Grid } from 'semantic-ui-react';

import CopyToClipboard from '../../helpers/CopyToClipboard';

// expected props
// networkInterfaces (via props)
// keyName (via props)
// connectionId (via props)
class ScEnvSshConnRowExpanded extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // The count down value
      this.countDown = undefined;
      this.intervalId = undefined;
      this.expired = false;
    });
  }

  get networkInterfaces() {
    const entries = this.props.networkInterfaces;
    if (_.isEmpty(entries)) return [];

    const result = [];
    _.forEach(entries, item => {
      if (item.publicDnsName) result.push({ value: item.publicDnsName, type: 'dns', scope: 'public', info: 'Public' });
      if (item.privateIp) result.push({ value: item.privateIp, type: 'ip', scope: 'private', info: 'Private' });
    });

    return result;
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
    this.countDown = 60;

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
    const keyName = this.keyName;
    const interfaces = this.networkInterfaces;
    const example = `ssh -i '${keyName}.pem' ec2-user@${_.get(_.first(interfaces), 'value')}`;

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
          <div className="mt3">
            Example:
            <Segment className="mt2">
              {example} <CopyToClipboard text={example} className="ml2 mt0" />
            </Segment>
          </div>
        </Table.Cell>
      </Table.Row>
    );
  }

  renderInfo() {
    const interfaces = this.networkInterfaces;
    const moreThanOne = _.size(interfaces) > 1;

    return (
      <div>
        <b>You&apos;ll need two pieces of information to connect to this research workspace.</b>
        <List bulleted>
          <List.Item>
            The IP Address or DNS of the instance.{' '}
            {moreThanOne ? 'Ask your administrator if you are not sure which one to use:' : ''}
            <List>
              {_.map(interfaces, network => (
                <List.Item key={network.value} className="flex">
                  {this.renderHostLabel(network)}
                  <CopyToClipboard text={network.value} />
                </List.Item>
              ))}
            </List>
          </List.Item>
          <List.Item>The SSH private key. You downloaded the private key when you created the SSH key.</List.Item>
        </List>
        <div className="mt3">
          Connecting to your research workspace depends on the operating system you are connecting from.
        </div>
        <List bulleted>
          <List.Item
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AccessingInstancesLinux.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Connecting from MacOS or Linux via SSH
          </List.Item>
          <List.Item
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/putty.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Connecting from Windows via Putty
          </List.Item>
        </List>
      </div>
    );
  }

  renderCountDown() {
    const expired = this.expired;
    const countDown = this.countDown;
    if (expired) {
      return (
        <div className="center color-red">
          The time window to connect has expired. To reset it, click on the <b className="fs-9">Use this SSH Key</b>{' '}
          button again.
        </div>
      );
    }

    return (
      <div className="center">
        <div className="mb1">
          You have <br /> <b>{countDown}</b> <br /> seconds to connect
        </div>
      </div>
    );
  }

  renderHostLabel(network) {
    return (
      <Label>
        Host
        <Label.Detail>
          {network.value} <span className="fs-7 pl1">({network.info})</span>
        </Label.Detail>
      </Label>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvSshConnRowExpanded, {
  networkInterfaces: computed,
  keyName: computed,
  connectionId: computed,
  intervalId: observable,
  countDown: observable,
  expired: observable,
  startCountDown: action,
  clearInterval: action,
});

export default inject()(withRouter(observer(ScEnvSshConnRowExpanded)));
