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
    const options = _.map(list, template => ({
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
