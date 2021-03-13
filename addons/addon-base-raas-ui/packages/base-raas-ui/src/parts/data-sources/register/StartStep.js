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
import { decorate, action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Segment, List, Button } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

// expected props
// wizard (via props)
class StartStep extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  get wizard() {
    return this.props.wizard;
  }

  handleNext = () => {
    this.wizard.advanceToNextStep();
  };

  handleCancel = () => {
    const goto = gotoFn(this);
    this.wizard.reset();

    goto('/data-sources');
  };

  render() {
    return (
      <>
        <Header as="h3" icon textAlign="center" className="mt2" color="grey">
          Register Studies
        </Header>
        <Segment clearing className="pt4 pr4 pl4 pb3">
          {this.renderBeforeYouStart()}
          {this.renderWhatIsNext()}
          {this.renderLimitations()}

          <div className="mt4">
            <Button
              floated="right"
              className="ml2"
              primary
              icon="right arrow"
              labelPosition="right"
              content="Next"
              onClick={this.handleNext}
            />
            <Button floated="right" className="ml2" content="Cancel" onClick={this.handleCancel} />
          </div>
        </Segment>
      </>
    );
  }

  renderBeforeYouStart() {
    return (
      <>
        <Header as="h3" className="mb0">
          Before you start
        </Header>
        <p className="ui large list mt2">
          You need to collect some information regarding the studies. The information that you need is:
        </p>
        <List bulleted size="large">
          <List.Item>
            The AWS account id of the account owning the studies and the region where the CloudFormation stack will be
            deployed
          </List.Item>
          <List.Item>The bucket name and region containing the studies</List.Item>
          <List.Item>
            The KMS ARN used to encrypt the bucket (if one is used) or the KMS ARNs used to encrypt each study
          </List.Item>
          <List.Item>The path of each study to be registered</List.Item>
          <List.Item>The access level desired for each study, can be either read only or read and write</List.Item>
        </List>
      </>
    );
  }

  renderWhatIsNext() {
    return (
      <>
        <Header as="h3" className="mb0">
          What to expect next
        </Header>

        <List bulleted size="large">
          <List.Item>You will be asked to provide the information listed above</List.Item>
          <List.Item>
            Some fields might be pre-populated for you if you had previously registered the account and/or the bucket
          </List.Item>
          <List.Item>You will be asked to assign study admins for each study</List.Item>
          <List.Item>Once you enter all the information requested, a CloudFormation template is generated</List.Item>
          <List.Item>You will be able to create/update the stack using the generated CloudFormation template</List.Item>
        </List>
      </>
    );
  }

  renderLimitations() {
    return (
      <>
        <Header as="h3" className="mb0">
          Limitations
        </Header>

        <List bulleted size="large">
          <List.Item>Studies can not contain other studies</List.Item>
          <List.Item>
            Buckets that restrict access to specific VPC endpoints and/or specific external IP addresses are not
            supported
          </List.Item>
          <List.Item>
            Different studies can be encrypted using different KMS keys, however, objects within the same study must be
            encrypted with the same key
          </List.Item>
          <List.Item>Accessing buckets via fips endpoints is not supported</List.Item>
          <List.Item>Buckets with requester pays are not supported</List.Item>
        </List>
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(StartStep, {
  wizard: computed,
  handleCancel: action,
  handleNext: action,
});

export default inject()(withRouter(observer(StartStep)));
