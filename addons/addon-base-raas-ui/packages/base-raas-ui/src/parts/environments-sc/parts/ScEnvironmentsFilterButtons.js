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
import { observer } from 'mobx-react';
import { Button } from 'semantic-ui-react';
import c from 'classnames';

import { filterNames } from '../../../models/environments-sc/ScEnvironmentsStore';

const filterColorMap = {
  [filterNames.ALL]: 'blue',
  [filterNames.AVAILABLE]: 'green',
  [filterNames.PENDING]: 'yellow',
  [filterNames.STOPPED]: 'orange',
  [filterNames.ERRORED]: 'red',
  [filterNames.TERMINATED]: 'grey',
};

// expected props
// - selectedFilter (via prop) the filter name of the currently selected filter
// - onSelectedFilter (via prop) a fn to be called when a button is selected
// - className (via prop) optional
class ScEnvironmentsFilterButtons extends React.Component {
  get selectedFilter() {
    return this.props.selectedFilter;
  }

  get onSelectedFilter() {
    const fn = this.props.onSelectedFilter;
    return _.isFunction(fn) ? fn : () => {};
  }

  handleSelected = name =>
    action(() => {
      this.onSelectedFilter(name);
    });

  render() {
    const selectedFilter = this.selectedFilter;
    const getAttrs = name => {
      const color = _.get(filterColorMap, name, 'grey');
      const selected = name === selectedFilter;
      const attrs = { active: selected, basic: !selected, color, style: { cursor: selected ? 'default' : 'pointer' } };
      if (!selected) attrs.onClick = this.handleSelected(name);
      return attrs;
    };

    return (
      <div className={c('clearfix', this.props.className)}>
        <Button.Group floated="right">
          {_.map(_.keys(filterColorMap), name => (
            <Button key={name} {...getAttrs(name)}>
              {_.startCase(name)}
            </Button>
          ))}
        </Button.Group>
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentsFilterButtons, {
  selectedFilter: computed,
  onSelectedFilter: computed,
});

export default observer(ScEnvironmentsFilterButtons);
