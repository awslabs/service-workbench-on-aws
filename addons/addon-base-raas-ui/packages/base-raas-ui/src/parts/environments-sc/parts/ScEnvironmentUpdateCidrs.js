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

import _ from 'lodash';
import IsCidr from 'is-cidr';
import React from 'react';
import { decorate, observable, computed, action, runInAction, reaction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Segment, Button, Message, Table } from 'semantic-ui-react';

import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreReady, isStoreError, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import Dropdown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import { createCidrFormModel } from '../../../models/forms/CreateCidrFormModel';

// expected props
// - environment (via prop)
// - scEnvironmentsStore  (via injection)
// - clientInformationStore (via injection)
// - onCancel is a function to pass back
class ScEnvironmentUpdateCidrs extends React.Component {
  constructor(props) {
    super(props);
    const store = this.getEnvStore();
    const sideEffect = storeReady => {
      runInAction(() => {
        if (storeReady) {
          this.ingressRules = _.map(this.environment.cidr, cidr => ({
            protocol: cidr.protocol,
            fromPort: cidr.fromPort,
            toPort: cidr.toPort,
            cidrBlocks: [],
          }));
          this.form = createCidrFormModel({
            existingValues: this.ingressRules,
          });
          _.forEach(this.ingressRules, ingressRule => {
            const origRuleIndex = _.findIndex(this.environment.cidr, {
              protocol: ingressRule.protocol,
              fromPort: ingressRule.fromPort,
              toPort: ingressRule.toPort,
            });

            this.ingressRules[origRuleIndex].cidrBlocks = this.environment.cidr[origRuleIndex].cidrBlocks;
            this.form.$(`cidr[${origRuleIndex}].cidrBlocks`).set(this.environment.cidr[origRuleIndex].cidrBlocks);
          });
        }
      });
    };
    this.disposer = reaction(() => /* stores.ready */ isStoreReady(store), sideEffect);
    sideEffect(isStoreReady(store));
  }

  componentDidMount() {
    const store = this.getEnvStore();
    if (store) {
      swallowError(store.load());
      store.startHeartbeat();
    }
  }

  componentWillUnmount() {
    if (this.disposer) {
      this.disposer();
    }

    const store = this.getEnvStore();
    if (store) {
      store.stopHeartbeat();
    }
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  get clientInformationStore() {
    return this.props.clientInformationStore;
  }

  getEnvStore() {
    const instanceId = this.environment.id;
    const store = this.envsStore;
    return store.getScEnvironmentStore(instanceId);
  }

  handleCancel = form => {
    form.reset();
    this.props.onCancel();
  };

  handleSubmit = async form => {
    const store = this.envsStore;
    try {
      const values = form.values();
      await store.updateScEnvironmentCidrs(this.environment.id, values);
      displaySuccess('Update Succeeded');
      this.props.onCancel();
    } catch (error) {
      displayError(error);
    }
  };

  renderWarning() {}

  render() {
    const store = this.getEnvStore();
    let content = null;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="pt2 mb2" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} className="mt2 mb2" />;
    } else if (isStoreReady(store)) {
      content = this.renderForm();
    } else {
      content = null;
    }

    return <Container className="mt3">{content}</Container>;
  }

  handleAddMyIp = ruleIndex => async event => {
    event.preventDefault();
    const clientInformationStore = this.clientInformationStore;
    try {
      await clientInformationStore.load();
    } catch (error) {
      // ignore intentionally
    }
    const currentIp = clientInformationStore.ipAddress;
    runInAction(() => {
      if (!_.includes(this.ingressRules[ruleIndex].cidrBlocks, `${currentIp}/32`)) {
        this.ingressRules[ruleIndex].cidrBlocks.push(`${currentIp}/32`);
      }
    });
  };

  renderForm() {
    const form = this.form;
    if (!form) {
      return null;
    }
    const fields = form.$('cidr');

    const anyWideCidr = () => {
      let wideCidrFound = false;
      _.forEach(this.ingressRules, rule => {
        if (!wideCidrFound)
          wideCidrFound = _.some(
            rule.cidrBlocks,
            cidr => _.endsWith(cidr, '/0') || _.endsWith(cidr, '/8') || _.endsWith(cidr, '/16'),
          );
      });
      return wideCidrFound;
    };

    const anyInvalidCidr = () => {
      let invalidCidrFound = false;
      _.forEach(this.ingressRules, rule => {
        if (!invalidCidrFound) invalidCidrFound = _.some(rule.cidrBlocks, cidr => IsCidr(cidr) !== 4);
      });
      return invalidCidrFound;
    };

    return (
      <Segment clearing className="p3 mb3">
        <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleSubmit}>
          {({ processing, onCancel }) => (
            <>
              <Table basic="very">
                <Table.Body>{fields.map((field, index) => this.renderItem(field, index, processing))}</Table.Body>
              </Table>
              {anyWideCidr() && (
                <Message
                  className="mb4"
                  icon="warning"
                  header="Wide CIDR block detected"
                  content="One or more CIDR blocks entered end with '/0', '/8', or '/16' and could be unnecessarily wide. This might allow workspace access to more IP ranges than intended"
                />
              )}
              {anyInvalidCidr() && (
                <Message
                  negative
                  className="mb4"
                  icon="warning"
                  header="Unsupported or Invalid CIDR block detected"
                  content="One or more options entered are not valid IPv4 CIDR blocks. Please enter CIDR blocks in the format: '255.255.255.255/32'"
                />
              )}
              <Button
                className="ml2"
                size="mini"
                floated="right"
                color="blue"
                icon
                disabled={processing || anyInvalidCidr()}
                type="submit"
              >
                Submit
              </Button>
              <Button floated="right" size="mini" disabled={processing} onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </Form>
      </Segment>
    );
  }

  renderItem(field, index, processing) {
    const options = _.map(this.ingressRules[index].cidrBlocks, cidrBlock => ({
      value: cidrBlock,
      text: cidrBlock,
    }));

    const dropdownOnChange = action((_event, data) => {
      this.ingressRules[index].cidrBlocks = data.value;
    });

    return (
      <Table.Row key={index}>
        <Table.Cell>
          <Input disabled field={field.$('protocol')} />
        </Table.Cell>
        <Table.Cell>
          <Input disabled field={field.$('fromPort')} />
        </Table.Cell>
        <Table.Cell>
          <Input disabled field={field.$('toPort')} />
        </Table.Cell>
        <Table.Cell>
          <Dropdown
            field={field.$('cidrBlocks')}
            allowAdditions
            search
            selection
            fluid
            multiple
            clearable
            additionLabel="Add: "
            noResultsMessage="Enter CIDR value"
            options={options}
            disabled={processing}
            onChange={dropdownOnChange}
          />
        </Table.Cell>
        <Table.Cell>
          <div className="mb3">
            <Button basic color="green" size="mini" onClick={this.handleAddMyIp(index)}>
              Add My IP
            </Button>
          </div>
        </Table.Cell>
      </Table.Row>
    );
  }
}

decorate(ScEnvironmentUpdateCidrs, {
  environment: computed,
  envsStore: computed,
  clientInformationStore: computed,

  ingressRules: observable,
  form: observable,
  handleSave: action,
  handleCancel: action,
});

export default inject('scEnvironmentsStore', 'clientInformationStore')(withRouter(observer(ScEnvironmentUpdateCidrs)));
