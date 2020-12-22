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
import React from 'react';
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Segment, Header, Divider } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import SelectionButtons from '@aws-ee/base-ui/dist/parts/helpers/fields/SelectionButtons';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import { regionOptions } from '../../../models/constants/aws-regions';
import { encryptionOptions } from '../../../models/constants/bucket';
import { getRegisterStudyForm } from '../../../models/forms/RegisterStudyForm';

// expected props
// - wizard (via prop)
class InputStep extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getRegisterStudyForm();
    });
  }

  get wizard() {
    return this.props.wizard;
  }

  handleSave = async form => {
    const data = form.values();
    swallowError(this.wizard.submit(data));
  };

  handleCancel = () => {
    const goto = gotoFn(this);
    this.wizard.reset();

    goto('/data-sources');
  };

  getFields(names, container) {
    const form = container || this.form;
    return _.map(names, name => form.$(name));
  }

  render() {
    return (
      <>
        <Header as="h3" icon textAlign="center" className="mt2" color="grey">
          Register Studies
        </Header>
        <Segment clearing className="p3">
          {this.renderForm()}
        </Segment>
      </>
    );
  }

  renderForm() {
    const form = this.form;
    const accountOptions = this.wizard.dropdownAccountOptions;
    const [account, bucket, studies] = this.getFields(['account', 'bucket', 'studies']);
    const accountIdValid = account.$('id').isValid;

    return (
      <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleSave}>
        {({ processing, /* onSubmit, */ onCancel }) => (
          <>
            <div className="clearfix">
              <DropDown
                field={account.$('id')}
                disabled={processing}
                options={accountOptions}
                search
                selection
                fluid
                allowAdditions
                clearable
                additionLabel=""
                className="mb3 mt3 col col-6 pr2"
              />
              <DropDown
                field={account.$('mainRegion')}
                disabled={processing}
                options={regionOptions}
                search
                selection
                fluid
                className="mb3 mt3 col col-6 pl2"
              />
            </div>
            <Input field={account.$('name')} className="mb3" />
            <TextArea field={account.$('contactInfo')} />

            <SelectionButtons field={bucket.$('sse')} show="headerOnly" className="mb0" />
            <SelectionButtons field={bucket.$('sse')} options={encryptionOptions} show="buttonsOnly" className="mb3" />

            {/* {studies.map(field => (
              <React.Fragment key={field.key}>
                <Input field={field.$('name')} className="mb3" />
                <Button
                  className="ml2"
                  primary
                  content="New"
                  disabled={processing}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    studies.add();
                  }}
                />
              </React.Fragment>
            ))} */}

            <Divider className="mt3 mb3" />

            <Button
              floated="right"
              className="ml2"
              primary
              icon="right arrow"
              labelPosition="right"
              content="Save &amp; Continue"
              disabled={processing || !accountIdValid}
              type="submit"
            />
            <Button floated="right" className="ml2" content="Cancel" disabled={processing} onClick={onCancel} />
          </>
        )}
      </Form>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(InputStep, {
  handleCancel: action,
  handleSave: action,
  wizard: computed,
  form: observable,
});

export default inject()(withRouter(observer(InputStep)));
