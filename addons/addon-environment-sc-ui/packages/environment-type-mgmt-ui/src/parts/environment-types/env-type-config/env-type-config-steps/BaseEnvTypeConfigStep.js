import React from 'react';
import { runInAction } from 'mobx';
import { Button, Segment } from 'semantic-ui-react';

import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import _ from 'lodash';

class BaseEnvTypeConfigStep extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = props.form;
      this.wizard = props.wizard;
    });
  }

  render() {
    const form = this.props.form;
    return (
      <Segment clearing className="mt3 p3">
        <Form form={form} onCancel={this.props.onCancel} onSuccess={this.props.onSubmit}>
          {({ processing, onCancel }) => (
            <>
              {this.renderFormFields({ form, processing, onCancel })}
              {this.renderActionButtons({ processing, onCancel })}
            </>
          )}
        </Form>
      </Segment>
    );
  }

  renderActionButtons({ processing, onCancel }) {
    const envTypConfig = this.getEnvTypeConfig();
    const isUpdating = !_.isEmpty(envTypConfig);

    const submitButtonTitle = isUpdating ? 'Save' : this.props.wizardModel.hasNext ? 'Next' : 'Add';
    return (
      <div>
        <Button
          className="ml2"
          primary
          content={submitButtonTitle}
          disabled={processing}
          type="submit"
          floated="right"
        />
        {!isUpdating && this.props.wizardModel.hasPrevious && (
          <Button
            className="ml2"
            primary
            content="Previous"
            disabled={processing}
            floated="right"
            onClick={this.props.onPrevious}
          />
        )}
        <Button basic color="grey" disabled={processing} onClick={onCancel} floated="left">
          Cancel
        </Button>
      </div>
    );
  }

  getEnvTypeConfig() {
    return this.props.envTypeConfig;
  }
}
export default BaseEnvTypeConfigStep;
