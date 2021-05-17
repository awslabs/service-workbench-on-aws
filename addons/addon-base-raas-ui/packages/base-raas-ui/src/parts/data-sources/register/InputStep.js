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
import { Button, Segment, Header, Divider, Label } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import SelectionButtons from '@aws-ee/base-ui/dist/parts/helpers/fields/SelectionButtons';
import YesNo from '@aws-ee/base-ui/dist/parts/helpers/fields/YesNo';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import { regionOptions } from '../../../models/constants/aws-regions';
import { encryptionOptions } from '../../../models/constants/bucket';
import { getRegisterStudyForm } from '../../../models/forms/RegisterStudyForm';

const fieldRuleKey = (container, name) => `${container.key}-${name}`;

// expected props
// - wizard (via prop)
// - userStore (via injection)
// - usersStore (via injection)
class InputStep extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getRegisterStudyForm();
      // We keep the field 'rules' in this map to help when we disable and then enable them. For example, if we disable
      // a required a field, then even if the field has a value, the validation will fail. So, if we disable a required
      // field, we need to also remove its rules but we need to bring the rules back if we enable the field again
      this.fieldRulesMap = {};
      // lets add the existing field rules to the map
      const [accountField] = this.getFields(['account']);
      const [bucketField] = this.getFields(['bucket']);

      this.rememberFieldsRules(accountField, ['name', 'mainRegion', 'contactInfo']);
      this.rememberFieldsRules(bucketField, ['name', 'region', 'sse', 'kmsArn']);
    });
  }

  get wizard() {
    return this.props.wizard;
  }

  get projectIdOptions() {
    return this.props.userStore.projectIdDropdown;
  }

  get userIdOptions() {
    // We want to filter out certain user types
    const list = this.props.usersStore.list;
    const result = [];
    _.forEach(list, user => {
      if (!user.isActive) return;
      if (user.isRootUser) return;
      if (user.isAdmin || user.isInternalResearcher || user.userRole === 'admin') {
        result.push({
          key: user.id,
          value: user.id,
          text: user.longDisplayName,
        });
      }
    });

    return result;
  }

  getFields(names, container) {
    const form = container || this.form;
    return _.map(names, name => form.$(name));
  }

  disableFields(container, names) {
    _.forEach(names, name => {
      const field = container.$(name);
      field.set('rules', null);
      field.set('disabled', true);
      field.resetValidation();
    });
  }

  enableFields(container, names) {
    _.forEach(names, name => {
      const field = container.$(name);
      field.set('rules', this.fieldRulesMap[fieldRuleKey(container, name)]);
      field.set('disabled', false);
      field.resetValidation();
    });
  }

  resetFields(container, names) {
    _.forEach(names, name => {
      const field = container.$(name);
      field.reset();
    });
  }

  rememberFieldsRules(container, names) {
    _.forEach(names, name => {
      const field = container.$(name);
      this.fieldRulesMap[fieldRuleKey(container, name)] = field.rules || {};
    });
  }

  syncKmsArnField() {
    const [field] = this.getFields(['bucket']);
    const showKmsArn = field.$('sse').value === 'kms';
    const kmsArn = field.$('kmsArn').value;

    if (showKmsArn) {
      field.$('kmsArn').set(kmsArn);
      this.enableFields(field, ['kmsArn']);
    } else {
      this.resetFields(field, ['kmsArn']);
      this.disableFields(field, ['kmsArn']);
    }
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

  handleAccountChange = accountId => {
    const wizard = this.wizard;
    const account = wizard.getAccount(accountId);
    const accountExists = !_.isEmpty(account);
    const [accountField] = this.getFields(['account']);
    const [bucketField] = this.getFields(['bucket']);

    accountField.$('id').resetValidation();

    this.resetFields(bucketField, ['name', 'region', 'sse']);
    this.enableFields(bucketField, ['name', 'region', 'sse']);
    this.syncKmsArnField();

    if (!accountExists) {
      this.resetFields(accountField, ['name', 'mainRegion', 'contactInfo']);
      this.enableFields(accountField, ['name', 'mainRegion', 'contactInfo']);

      return;
    }

    accountField.$('mainRegion').set(account.mainRegion);
    accountField.$('name').set(account.name);
    accountField.$('contactInfo').set(account.contactInfo || '');
    this.disableFields(accountField, ['name', 'mainRegion', 'contactInfo']);
  };

  handleBucketChange = bucketName => {
    const wizard = this.wizard;
    const [accountField] = this.getFields(['account']);
    const accountId = accountField.$('id').value;
    const bucket = wizard.getBucket({ accountId, bucketName });
    const bucketExists = !_.isEmpty(bucket);
    const [field] = this.getFields(['bucket']);

    field.$('name').resetValidation();

    if (!bucketExists) {
      this.resetFields(field, ['region', 'sse', 'kmsArn']);
      this.enableFields(field, ['region', 'sse']);
      this.syncKmsArnField();
      return;
    }

    field.$('region').set(bucket.region);
    field.$('sse').set(bucket.sse);
    field.$('kmsArn').set(bucket.kmsArn);
    this.syncKmsArnField();
    this.disableFields(field, ['region', 'sse', 'kmsArn']);
  };

  handleEncryptionChange = () => {
    this.syncKmsArnField();
  };

  handleAddStudy = event => {
    event.preventDefault();
    event.stopPropagation();
    const [studies] = this.getFields(['studies']);
    const newField = studies.add();

    newField.$('category').set('Organization'); // Set the default
    newField.$('accessType').set('readonly'); // Set the default
    newField.$('adminUsers').set([]);
  };

  handleDeleteStudy = key =>
    action(event => {
      event.preventDefault();
      event.stopPropagation();
      this.form.$('studies').del(key);
    });

  handleStudyTypeChange = studyField =>
    action(value => {
      if (value === 'My Studies') {
        studyField.$('adminUsers').set('');
      } else {
        studyField.$('adminUsers').set([]);
      }
    });

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
    const wizard = this.wizard;
    const form = this.form;
    const [accountField, bucketField, studies] = this.getFields(['account', 'bucket', 'studies']);
    const accountOptions = wizard.dropdownAccountOptions;
    const accountId = accountField.$('id').value;
    const accountIdValid = accountField.$('id').isValid;
    const bucketOptions = wizard.getDropdownBucketOptions(accountId);
    const showKmsArn = bucketField.$('sse').value === 'kms';
    const studiesSize = studies.size;
    const addButtonLabel = studiesSize > 0 ? 'Add Another Study' : 'Add Study';

    return (
      <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleSave}>
        {({ processing, /* onSubmit, */ onCancel }) => (
          <>
            <div className="clearfix">
              <DropDown
                field={accountField.$('id')}
                options={accountOptions}
                search
                selection
                fluid
                allowAdditions
                clearable
                additionLabel=""
                className="mb3 mt0 col col-6 pr2"
                onChange={this.handleAccountChange}
              />
              <DropDown
                field={accountField.$('mainRegion')}
                options={regionOptions}
                search
                selection
                fluid
                className="mb3 mt0 col col-6 pl2"
              />
            </div>
            <Input field={accountField.$('name')} className="mb3" />
            <TextArea field={accountField.$('contactInfo')} className="mb3" />

            <Divider horizontal className="mt4 mb4">
              Bucket Information
            </Divider>

            <div className="clearfix">
              <DropDown
                field={bucketField.$('name')}
                options={bucketOptions}
                search
                selection
                fluid
                allowAdditions
                clearable
                additionLabel=""
                className="mb3 mt0 col col-6 pr2"
                onChange={this.handleBucketChange}
              />
              <DropDown
                field={bucketField.$('region')}
                options={regionOptions}
                search
                selection
                fluid
                className="mb3 mt0 col col-6 pl2"
              />
            </div>
            <SelectionButtons field={bucketField.$('sse')} show="headerOnly" className="mb0" />
            <SelectionButtons
              field={bucketField.$('sse')}
              options={encryptionOptions}
              show="buttonsOnly"
              className="mb3"
              onChange={this.handleEncryptionChange}
            />
            {showKmsArn && <Input field={bucketField.$('kmsArn')} className="mb3" />}

            <Divider horizontal className="mt4 mb4">
              Studies
            </Divider>

            {studies.map(field => this.renderStudyField({ field }))}

            <Button basic primary content={addButtonLabel} className="mt3" fluid onClick={this.handleAddStudy} />
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

  renderStudyField({ field }) {
    const myStudies = field.$('category').value === 'My Studies';

    return (
      <Segment key={field.key} clearing className="mt3 p3">
        <Label floating size="tiny" className="cursor-pointer" onClick={this.handleDeleteStudy(field.key)}>
          X
        </Label>
        <div className="clearfix">
          <Input field={field.$('id')} className="mb3 mt0 col col-6 pr2" />
          <Input field={field.$('name')} className="mb3 mt0 col col-6 pl2" />
        </div>

        <div className="clearfix">
          <Input field={field.$('folder')} className="mb3 mt0 col col-6 pr2" />
          <DropDown
            field={field.$('projectId')}
            options={this.projectIdOptions}
            search
            fluid
            selection
            clearable
            className="mb3 mt0 col col-6 pl2"
          />
        </div>

        <div className="clearfix">
          <div className="mb3 mt0 col col-6 pr2">
            <YesNo field={field.$('category')} className="mt3 mb3" onClick={this.handleStudyTypeChange(field)} />
            <YesNo field={field.$('accessType')} className="mt2 mb2" />
          </div>
          <TextArea field={field.$('description')} className="mb3 mt0 col col-6 pl2" />
        </div>

        <Input field={field.$('kmsArn')} className="mb3" />
        <DropDown
          field={field.$('adminUsers')}
          selection
          fluid
          multiple={!myStudies}
          search
          options={this.userIdOptions}
          className="mb0"
        />
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(InputStep, {
  handleCancel: action,
  handleSave: action,
  handleAccountChange: action,
  handleBucketChange: action,
  handleEncryptionChange: action,
  handleAddStudy: action,
  handleDeleteStudy: action,
  handleStudyTypeChange: action,
  projectIdOptions: computed,
  wizard: computed,
  userIdOptions: computed,
  form: observable,
});

export default inject('userStore', 'usersStore')(withRouter(observer(InputStep)));
