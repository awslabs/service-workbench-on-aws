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
import { observer, inject } from 'mobx-react';
import { decorate, action, runInAction, observable } from 'mobx';
import { Dropdown } from 'semantic-ui-react';
import c from 'classnames';

// expected props
// - stepTemplatesStore (via props)
// - onSelected (via props) (optional), a function that receives (step)
// - disabled (via props) (optional), default to false
// - className (via props)
class AddStepDropDown extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.selectedStep = undefined;
    });
  }

  getStore() {
    return this.props.stepTemplatesStore;
  }

  getSelectedStep() {
    return this.selectedStep;
  }

  getStepDropDownOptions() {
    const store = this.getStore();
    const list = store.list;
    const options = _.map(list, (template) => ({
      text: template.latest.title,
      value: template.id,
    }));

    return options;
  }

  handleChange = (_event, { value }) => {
    if (_.isEmpty(value)) {
      this.selectedStep = undefined;
      return;
    }

    const store = this.getStore();
    const step = store.getTemplate(value);
    if (step === undefined) {
      this.selectedStep = undefined;
      return;
    }
    this.selectedStep = step.latest;
  };

  handleClose = (e, _d) => {
    const onSelected = this.props.onSelected || _.noop;
    const step = this.selectedStep;

    this.selectedStep = undefined;
    if (e === undefined) return; // this means the escape key was clicked
    onSelected(step);
  };

  render() {
    const disabled = this.props.disabled || false;
    const className = this.props.className;
    const step = this.getSelectedStep();
    const options = this.getStepDropDownOptions();
    const isEmpty = _.isEmpty(step);
    const text = isEmpty ? 'Add Step' : step.title;
    const value = isEmpty ? '' : step.id;

    return (
      <Dropdown
        button
        className={c('icon', className)}
        fluid
        labeled
        icon="plus"
        options={options}
        search
        color="blue"
        text={text}
        value={value}
        onChange={this.handleChange}
        onClose={this.handleClose}
        disabled={disabled}
      />
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AddStepDropDown, {
  selectedStep: observable,
  handleChange: action,
  handleClose: action,
});

export default inject('stepTemplatesStore')(observer(AddStepDropDown));
