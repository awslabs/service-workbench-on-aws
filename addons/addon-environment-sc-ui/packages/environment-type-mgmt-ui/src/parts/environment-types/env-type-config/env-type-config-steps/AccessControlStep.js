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
import { inject, observer } from 'mobx-react';
import { computed, decorate } from 'mobx';

import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import BaseEnvTypeConfigStep from './BaseEnvTypeConfigStep';

class AccessControlStep extends BaseEnvTypeConfigStep {
  renderFormFields({ form, processing }) {
    const allowRoleIdsField = form.$('allowRoleIds') || [];
    const denyRoleIdsField = form.$('denyRoleIds') || [];

    const userRoleOptions = _.filter(
      this.userRolesStore.dropdownOptions,
      // Also currently not supporting external roles i.e., guest and external-researcher so exclude them from
      // "allow" or "deny" list
      r => !_.includes(['external-researcher', 'guest'], _.toLower(r.value)),
    );
    return (
      <>
        <DropDown
          dataTestId="allow-dropdown"
          field={allowRoleIdsField}
          options={userRoleOptions}
          selection
          multiple
          fluid
          disabled={processing}
        />
        <DropDown field={denyRoleIdsField} options={userRoleOptions} selection multiple fluid disabled={processing} />
      </>
    );
  }

  get userRolesStore() {
    return this.props.userRolesStore;
  }
}

decorate(AccessControlStep, {
  userRolesStore: computed,
});
export default inject('userRolesStore')(observer(AccessControlStep));
