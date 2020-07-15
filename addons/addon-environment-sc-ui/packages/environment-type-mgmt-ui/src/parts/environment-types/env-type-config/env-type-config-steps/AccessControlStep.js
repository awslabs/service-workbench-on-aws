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
        <DropDown field={allowRoleIdsField} options={userRoleOptions} selection multiple fluid disabled={processing} />
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
