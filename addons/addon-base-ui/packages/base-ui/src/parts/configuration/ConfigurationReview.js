import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import { decorate, action, runInAction, observable } from 'mobx';
import { Button, Icon, Segment, Dimmer, Loader } from 'semantic-ui-react';

import { displayError } from '../../helpers/notification';
import ConfigTable from './ConfigTable';

// expected props
// - model - an instance of the ConfigurationEditor model instance (via props)
// - onCancel (via props) is called after all the necessary clean up
// - onSave (via props) is called with (configuration) which is just an object with key/value pairs
// - dimmer (via props) default to true, set to false if you don't want to use the dimmer (buttons will still be disabled during processing)
class ConfigurationReview extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.processing = false;
    });
  }

  getModel() {
    return this.props.model;
  }

  getForm() {
    const model = this.getModel();
    return model.form;
  }

  getDimmer() {
    const dimmer = this.props.dimmer;
    return _.isUndefined(dimmer) ? true : !!dimmer;
  }

  handleCancel = () => {
    this.processing = false;
    const onCancel = this.props.onCancel || _.noop;
    const model = this.getModel();
    model.cancel();

    return onCancel();
  };

  handleSave = async () => {
    const onSave = this.props.onSave || _.noop;
    const model = this.getModel();
    const configuration = {};

    /* eslint-disable no-restricted-syntax */
    for (const [key, value] of model.configuration.entries()) {
      configuration[key] = value;
    }
    /* eslint-enable no-restricted-syntax */

    try {
      this.processing = true;
      await onSave(configuration);
      runInAction(() => {
        this.processing = false;
      });
      model.applyChanges();
      model.restart();
    } catch (error) {
      runInAction(() => {
        this.processing = false;
      });
      displayError(error);
    }
  };

  handlePrevious = event => {
    event.preventDefault();
    event.stopPropagation();
    const form = this.getForm();
    const model = this.getModel();

    this.processing = false;
    model.previous(form);
  };

  render() {
    const processing = this.processing;
    const dimmer = this.getDimmer();
    const model = this.getModel();
    const configRows = model.definedConfigList || [];
    const empty = configRows.length === 0;
    const review = model.review;
    const buttons = (
      <div className="mt3 clearfix">
        {review && (
          <Button
            floated="right"
            color="blue"
            icon="save"
            labelPosition="left"
            disabled={processing || !review || empty}
            className="ml2"
            content="Save"
            onClick={this.handleSave}
          />
        )}
        <Button floated="right" icon disabled={processing} labelPosition="left" onClick={this.handlePrevious}>
          Previous
          <Icon name="left arrow" />
        </Button>
        <Button floated="left" disabled={processing} onClick={this.handleCancel}>
          Cancel
        </Button>
      </div>
    );

    let content = <ConfigTable rows={configRows} />;
    if (empty) content = 'No configuration values are provided';

    return (
      <>
        {review && (
          <Segment padded>
            {dimmer && (
              <Dimmer active={processing} inverted>
                <Loader inverted>Processing</Loader>
              </Dimmer>
            )}
            {content}
          </Segment>
        )}
        {buttons}
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ConfigurationReview, {
  processing: observable,
  handleSave: action,
  handlePrevious: action,
  handleCancel: action,
});

export default observer(ConfigurationReview);
