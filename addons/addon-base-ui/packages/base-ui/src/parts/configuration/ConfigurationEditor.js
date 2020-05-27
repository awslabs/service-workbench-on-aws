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
import { decorate, action } from 'mobx';
import { Button, Icon, Segment, Step } from 'semantic-ui-react';

import Form from '../helpers/fields/Form';
import InputEntriesRenderer from './InputEntriesRenderer';

// expected props
// - model - an instance of the ConfigurationEditor model instance (via props)
// - onCancel (via props) is called after all the necessary clean up
class ConfigurationEditor extends React.Component {
  getModel() {
    return this.props.model;
  }

  getForm() {
    const model = this.getModel();
    return model.form;
  }

  handleCancel = () => {
    const onCancel = this.props.onCancel || _.noop;
    const model = this.getModel();
    model.cancel();

    return onCancel();
  };

  handleNext = form => {
    const model = this.getModel();
    model.next(form);
  };

  handlePrevious = event => {
    event.preventDefault();
    event.stopPropagation();
    const form = this.getForm();
    const model = this.getModel();

    model.previous(form);
  };

  handleClear = event => {
    event.preventDefault();
    event.stopPropagation();
    const form = this.getForm();
    const model = this.getModel();
    model.clearSectionConfigs();
    form.reset();
  };

  render() {
    const form = this.getForm();
    const model = this.getModel();
    const hasPrevious = model.hasPrevious;
    const inputManifestSection = model.inputManifestSection || {};
    const inputEntries = inputManifestSection.children || [];
    const empty = inputEntries.length === 0;

    return (
      <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleNext}>
        {({ processing, errors, _onSubmit, onCancel }) => (
          <>
            {!empty && (
              <div className="mt3 clearfix p2">
                {this.renderSectionTitles(errors)}
                <InputEntriesRenderer form={form} inputEntries={inputEntries} processing={processing} />
              </div>
            )}
            {empty && (
              <Segment padded className="mb3">
                No configuration values are provided
              </Segment>
            )}

            <div className="mt0 clearfix">
              <Button
                floated="right"
                type="submit"
                color="blue"
                icon
                disabled={processing}
                className="ml2"
                labelPosition="right"
              >
                Next
                <Icon name="right arrow" />
              </Button>
              {hasPrevious && (
                <Button
                  floated="right"
                  className="ml2"
                  icon
                  disabled={processing}
                  labelPosition="left"
                  onClick={this.handlePrevious}
                >
                  Previous
                  <Icon name="left arrow" />
                </Button>
              )}
              <Button floated="right" disabled={processing} onClick={this.handleClear}>
                Clear
              </Button>
              <Button floated="left" disabled={processing} onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Form>
    );
  }

  renderSectionTitles(errors) {
    const model = this.getModel();
    const totalSections = model.totalSections;
    const currentSectionIndex = model.currentSectionIndex;
    const showSectionTitles = totalSections > 1;
    const sectionTitles = model.sectionsTitles;
    const hasError = errors.length > 0;
    if (!showSectionTitles) return null;
    if (totalSections < 3) return null; // only show the titles when we have 3 or more sections

    return (
      <Step.Group size="mini" fluid>
        {_.times(totalSections, index => (
          <Step active={index === currentSectionIndex} completed={index < currentSectionIndex}>
            {hasError && index === currentSectionIndex ? <Icon name="times" /> : <Icon name="setting" />}
            <Step.Content>
              <Step.Title>{sectionTitles[index] || ''}</Step.Title>
            </Step.Content>
          </Step>
        ))}
      </Step.Group>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ConfigurationEditor, {
  handleNext: action,
  handlePrevious: action,
  handleCancel: action,
  handleClear: action,
});

export default observer(ConfigurationEditor);
