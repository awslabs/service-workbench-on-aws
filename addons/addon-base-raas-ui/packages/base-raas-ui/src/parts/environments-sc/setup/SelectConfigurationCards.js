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
import { Card, Radio, Divider, Table, Header as SemanticHeader } from 'semantic-ui-react';
import c from 'classnames';
import Header from '@aws-ee/base-ui/dist/parts/helpers/fields/Header';
import Description from '@aws-ee/base-ui/dist/parts/helpers/fields/Description';
import ErrorPointer from '@aws-ee/base-ui/dist/parts/helpers/fields/ErrorPointer';
import { nicePrice } from '@aws-ee/base-ui/dist/helpers/utils';

// expected props
// - configurations (via props) and array of the env type configurations MST
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
          <Card
            data-testid="configuration-card"
            key={config.id}
            className={c('mb3', { 'cursor-pointer': !disabled })}
            {...getAttrs(config)}
          >
            <Card.Content>
              <Card.Header>
                <div className="flex mt1">
                  <Radio className="mr2" checked={isSelected(config)} disabled={disabled} />
                  <SemanticHeader as="h4" className="flex-auto mt0 pt0">
                    {config.name}
                  </SemanticHeader>
                </div>
                <Divider />
              </Card.Header>
              <Card.Description>
                <div className="pr1 pl1 pb1">
                  {/* Yes, we are doing dangerouslySetInnerHTML, the content was already sanitized by showdownjs */}
                  {/* eslint-disable-next-line react/no-danger */}
                  <div dangerouslySetInnerHTML={{ __html: config.descHtml }} />
                </div>
                <Divider />
                {this.renderEstimatedCostInfo(config)}
                {this.renderInstanceType(config)}
              </Card.Description>
            </Card.Content>
          </Card>
        ))}
      </Card.Group>
    );
  }

  renderEstimatedCostInfo(config) {
    const hasCost = !_.isEmpty(config.estimatedCostInfoHtml);
    let content = (
      <div className="flex p1">
        <div className="bold flex-auto">Estimated Cost</div>
        <div className="pr1">N/A</div>
      </div>
    );
    if (hasCost) {
      content = (
        <div className="p1">
          <div className="mb2 bold">Estimated Cost</div>
          {/* eslint-disable-next-line react/no-danger */}
          <div dangerouslySetInnerHTML={{ __html: config.estimatedCostInfoHtml }} />
        </div>
      );
    }

    return content;
  }

  renderInstanceType(config) {
    const content = (
      <div className="flex p1">
        <div className="bold flex-auto">Instance Type</div>
        <div className="pr1">{config.instanceType}</div>
      </div>
    );

    return content;
  }

  renderTableInfo(config) {
    // estimatedCostInfo
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
