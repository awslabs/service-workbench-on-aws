import _ from 'lodash';
import React from 'react';
import { decorate } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Divider, Icon, Header } from 'semantic-ui-react';

import Input from '../helpers/fields/Input';
import YesNo from '../helpers/fields/YesNo';
import DropDown from '../helpers/fields/DropDown';
import TextArea from '../helpers/fields/TextArea';

// expected props
// - form (via props)
// - inputEntry (via props)
// - processing (via props) (default to false)
class InputEntryRenderer extends React.Component {
  getForm() {
    return this.props.form;
  }

  getInputEntry() {
    return this.props.inputEntry;
  }

  getProcessing() {
    return this.props.processing || false;
  }

  render() {
    // entry is an object of a shape like:
    // { name: 'id',  type: 'string/yesNo,..', label, children: [ <optional> ], .. }
    const entry = this.getInputEntry();
    const field = this.getField();

    return (
      <>
        {this.renderDivider(entry)}
        {field}
      </>
    );
  }

  renderDivider(entry) {
    if (entry.divider === undefined) return null;
    const divider = entry.divider;
    const hasIcon = !!divider.icon;

    if (_.isBoolean(entry.divider)) return <Divider className="mb3 mt0" />;

    return (
      <Divider horizontal className="mb3 mt0">
        <Header as="h4" color="grey">
          {hasIcon && <Icon name={divider.icon} color="grey" />}
          {divider.title}
        </Header>
      </Divider>
    );
  }

  getField() {
    const processing = this.getProcessing();
    const form = this.getForm();
    // entry is an object of a shape like:
    // { name: 'id',  type: 'string/yesNo,..', label, children: [ <optional> ], .. }
    const entry = this.getInputEntry();
    const field = form.$(entry.name);

    switch (entry.type) {
      case 'stringInput':
        return <Input field={field} disabled={processing} />;
      case 'yesNoInput':
        return <YesNo field={field} disabled={processing} />;
      case 'dropDownInput':
        return <DropDown field={field} fluid selection disabled={processing} />;
      case 'textAreaInput':
        return <TextArea field={field} disabled={processing} />;

      default:
        return <></>;
    }
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(InputEntryRenderer, {});

export default inject()(observer(InputEntryRenderer));
