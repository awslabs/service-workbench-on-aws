import React from 'react';
import { observer } from 'mobx-react';
import { action, decorate, observable, runInAction } from 'mobx';
import { Button, Dimmer, Header, Icon, Segment, Table } from 'semantic-ui-react';

import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import NameValuesEditor from '@aws-ee/base-ui/dist/parts/helpers/fields/NameValuesEditor';
import _ from 'lodash';
import BaseEnvTypeConfigStep from './BaseEnvTypeConfigStep';

class TagsStep extends BaseEnvTypeConfigStep {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.processing = false;
      this.shouldEnableActionButtons = true;
    });
  }

  render() {
    const form = this.form;
    return (
      <Segment clearing className="mt3">
        <Dimmer active={this.processing} inverted />
        {this.renderFormFields({ form })}
        <Form form={form} onCancel={this.props.onCancel} onSuccess={this.props.onSubmit}>
          {({ processing, onCancel }) => <>{this.renderActionButtons({ processing, onCancel })}</>}
        </Form>
      </Segment>
    );
  }

  // eslint-disable-next-line no-unused-vars
  renderFormFields({ form }) {
    const tagsField = form.$('tags');
    return (
      <div className="mb3">
        <div className="ml1 mb2">
          Click plus (+) button below to add resource tags. These tags will be applied to the environment resources that
          are launched using this configuration. Additionally, some standard tags for cost allocation will be
          automatically applied even if you do not configure any other resource tags here.
        </div>
        <NameValuesEditor
          field={tagsField}
          onEnterEditMode={this.disableActionButtons}
          onExitEditMode={this.enableActionButtons}
          emptyRenderer={() => (
            <Table.Row key="empty-row" textAlign="center">
              <Table.Cell colSpan={3}>
                <Header icon className="color-grey">
                  <Icon name="tags" />
                  No resource tags are added yet
                </Header>
              </Table.Cell>
            </Table.Row>
          )}
        />
      </div>
    );
  }

  renderActionButtons({ processing, onCancel }) {
    const envTypConfig = this.getEnvTypeConfig();
    const isUpdating = !_.isEmpty(envTypConfig);
    const submitButtonTitle = isUpdating ? 'Save' : this.props.wizardModel.hasNext ? 'Next' : 'Add';
    return (
      <div className="clearfix">
        <Button
          onClick={action(() => {
            this.processing = true;
          })}
          className="ml2 mb3"
          primary
          content={submitButtonTitle}
          disabled={processing || !this.shouldEnableActionButtons}
          type="submit"
          floated="right"
        />
        {!isUpdating && this.props.wizardModel.hasPrevious && (
          <Button
            className="ml2 mb3"
            primary
            content="Previous"
            disabled={processing || !this.shouldEnableActionButtons}
            floated="right"
            onClick={this.props.onPrevious}
          />
        )}
        <Button
          basic
          color="grey"
          disabled={processing || !this.shouldEnableActionButtons}
          onClick={onCancel}
          floated="left"
        >
          Cancel
        </Button>
      </div>
    );
  }

  disableActionButtons = () => {
    this.shouldEnableActionButtons = false;
  };

  enableActionButtons = () => {
    this.shouldEnableActionButtons = true;
  };
}

decorate(TagsStep, {
  disableActionButtons: action,
  enableActionButtons: action,

  processing: observable,
  shouldEnableActionButtons: observable,
});
export default observer(TagsStep);
