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
import { observer } from 'mobx-react';
import { decorate, action, observable, runInAction } from 'mobx';
import { Dimmer, Loader, Message } from 'semantic-ui-react';
import c from 'classnames';

// expected props
// - form (via props) the mobx form instance
// - onSuccess (via props) is called once mobx form calls on hooks.onSuccess(), receives (form)
// - onError (via props) is called once mobx form calls on hooks.onError(), receives (form)
// - onCancel (via props) receives (form)
// - dimmer (via props) default to true, set to false if you don't want to use the dimmer (buttons will still be disabled during processing)
// - className (via props)
class Form extends React.Component {
  constructor(props) {
    super(props);
    this.formHooks = {
      onSuccess: this.handleFormSubmission,
      onError: this.handleFormErrors,
    };

    runInAction(() => {
      this.formProcessing = false;
    });
  }

  getForm() {
    return this.props.form;
  }

  getDimmer() {
    const dimmer = this.props.dimmer;
    return _.isUndefined(dimmer) ? true : !!dimmer;
  }

  getOnCancel() {
    return this.props.onCancel || _.noop;
  }

  getOnSuccess() {
    return this.props.onSuccess || _.noop;
  }

  getOnError() {
    return this.props.onError || _.noop;
  }

  getFormErrors() {
    const form = this.getForm();
    const errorMap = form.errors() || {};
    const errors = [];
    const visit = (obj) => {
      if (_.isNil(obj)) return;
      if (_.isString(obj) && !_.isEmpty(obj)) {
        errors.push(obj);
        return;
      }
      if (_.isArray(obj) || _.isObject(obj)) {
        _.forEach(obj, (value) => {
          visit(value);
        });
      }
    };

    visit(errorMap);
    return errors;
  }

  handleFormSubmission = async (form) => {
    const onSuccess = this.getOnSuccess();
    this.formProcessing = true;
    try {
      const result = await onSuccess(form);
      runInAction(() => {
        this.formProcessing = false;
      });

      return result;
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });

      throw error;
    }
  };

  handleFormErrors = async (form) => {
    const onError = this.getOnError();
    this.formProcessing = false;
    const errors = this.getFormErrors();

    return onError(form, errors);
  };

  handleSubmit = (event) => {
    const form = this.getForm();
    event.preventDefault();
    event.stopPropagation();
    this.formProcessing = true;
    try {
      return form.onSubmit(event, this.formHooks);
    } catch (error) {
      this.formProcessing = false;
      throw error;
    }
  };

  handleCancel = (event) => {
    const form = this.getForm();
    const onCancel = this.getOnCancel();

    event.preventDefault();
    event.stopPropagation();
    this.formProcessing = false;
    form.reset();
    onCancel(form);
  };

  renderErrorPanel() {
    const errors = this.getFormErrors();
    const size = errors.length;
    if (size === 0) return null;
    const title = `Please Correct The Following Error${size === 1 ? '' : 's'}`;
    const toMessage = (msg) => (_.isObject(msg) ? JSON.stringify(msg) : `${msg}`);

    return (
      <Message className="mb3 mt0 animated fadeIn" negative>
        <Message.Header>{title}</Message.Header>
        <Message.List>
          {_.map(errors, (msg, index) => (
            <Message.Item key={index}>{toMessage(msg)}</Message.Item>
          ))}
        </Message.List>
      </Message>
    );
  }

  render() {
    const processing = this.formProcessing;
    const renderer = _.isFunction(this.props.children) ? this.props.children : _.noop;
    const className = this.props.className;
    const dimmer = this.getDimmer();
    const errors = this.getFormErrors();

    return (
      <form className={c('ui fluid form', className)} onSubmit={this.handleSubmit}>
        {dimmer && (
          <Dimmer active={processing} inverted>
            <Loader inverted>Processing</Loader>
          </Dimmer>
        )}
        {this.renderErrorPanel()}
        {renderer({
          processing,
          errors,
          onSubmit: this.handleSubmit,
          onCancel: this.handleCancel,
        })}
      </form>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Form, {
  formProcessing: observable,
  handleSubmit: action,
  handleFormSubmission: action,
  handleFormErrors: action,
  handleCancel: action,
});

export default observer(Form);
