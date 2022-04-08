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
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Card, Radio, Divider, Table } from 'semantic-ui-react';
import c from 'classnames';
import Header from '@amzn/base-ui/dist/parts/helpers/fields/Header';
import Description from '@amzn/base-ui/dist/parts/helpers/fields/Description';
import ErrorPointer from '@amzn/base-ui/dist/parts/helpers/fields/ErrorPointer';
import { nicePrice } from '@amzn/base-ui/dist/helpers/utils';

// expected props
// - configurations (via props) and array of the compute configurations MST
// - formField (via props) an instance of the mobx form field
class SelectConfigurationCards extends React.Component {
  get configurations() {
    return this.props.configurations;
  }

  get configurationId() {
    return this.formField.value;
  }

  get formField() {
    return this.props.formField;
  }

  handleSelectConfigurationId = configId => {
    this.formField.sync(configId);
    this.formField.resetValidation();
  };

  render() {
    const field = this.formField;
    const { error = '' } = field;
    const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError
    const isDisabled = field.disabled;
    const disabledClass = isDisabled ? 'disabled' : '';
    const errorClass = hasError ? 'error' : '';

    return (
      <div className={c('mb4', errorClass, disabledClass)}>
        <Header field={field} />
        <Description field={field} />
        <ErrorPointer field={field} className="mb1" />
        {this.renderCards()}
      </div>
    );
  }

  renderCards() {
    const disabled = this.formField.disabled;
    const configurations = this.configurations;
    const isSelected = config => config.id === this.configurationId;
    const getAttrs = config => {
      const attrs = {};
      if (isSelected(config)) attrs.color = 'blue';
      if (!disabled) attrs.onClick = () => this.handleSelectConfigurationId(config.id);

      return attrs;
    };

    return (
      <Card.Group stackable itemsPerRow={3} className="mt1">
        {_.map(configurations, config => (
          <Card key={config.id} className={c('mb3', { 'cursor-pointer': !disabled })} {...getAttrs(config)}>
            <Card.Content>
              <Card.Header>
                <Radio className="mr2" checked={isSelected(config)} disabled={disabled} />
                {config.title}
                <Divider />
              </Card.Header>
              <Card.Description>
                <div className="pr1 pl1 pb1">
                  {/* Yes, we are doing dangerouslySetInnerHTML, the content was already sanitized by showdownjs */}
                  {/* eslint-disable-next-line react/no-danger */}
                  <div dangerouslySetInnerHTML={{ __html: config.descHtml }} />
                </div>
              </Card.Description>
            </Card.Content>
            <Card.Content extra>{this.renderTableInfo(config)}</Card.Content>
          </Card>
        ))}
      </Card.Group>
    );
  }

  renderTableInfo(config) {
    const priceTitle = item => {
      const isSpot = _.get(item, 'priceInfo.type') === 'spot';
      return isSpot ? 'Maximum price per day' : 'Price per day';
    };
    const region = item => _.get(item, 'priceInfo.region');
    const price = item => {
      const perDay = item.pricePerDay;
      if (_.isUndefined(perDay) || (_.isString(perDay) && _.isEmpty(perDay))) return 'N/A';
      return `$${nicePrice(perDay)}`;
    };

    return (
      <Table basic="very" size="small">
        <Table.Body>
          {_.map(config.displayProps).map((property, propertyIndex) => {
            return (
              // eslint-disable-next-line react/no-array-index-key
              <Table.Row key={propertyIndex} textAlign="center">
                <Table.Cell>{property.key}</Table.Cell>
                <Table.Cell>{property.value}</Table.Cell>
              </Table.Row>
            );
          })}
          <Table.Row textAlign="center">
            <Table.Cell>
              {priceTitle(config)}
              <div className="color-grey fs-9">{region(config)}</div>
            </Table.Cell>
            <Table.Cell verticalAlign="top">{price(config)}</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(SelectConfigurationCards, {
  configurations: computed,
  configurationId: computed,
  formField: computed,
  handleSelectConfigurationId: action,
});

export default inject()(observer(SelectConfigurationCards));
