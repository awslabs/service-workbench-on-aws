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
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Label, Popup, Placeholder } from 'semantic-ui-react';

import { isStoreLoading, isStoreError, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';

// This component displays the name of the env type. The envTypeId is expected to be passed
// as a prop to this component. This component displays a progress place holder or an error with a popup
// message if the env type name can't be determined.

// expected props
// - envTypeId  (via prop)
// - envTypesStore (via injection)
class ScEnvironmentTypeName extends React.Component {
  componentDidMount() {
    const store = this.getEnvTypeStore();
    if (store && !isStoreReady(store)) {
      swallowError(store.load());
    }
  }

  get envTypeId() {
    return this.props.envTypeId;
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  getEnvTypeStore() {
    const envTypesStore = this.envTypesStore;
    const envTypeId = this.envTypeId;
    return envTypesStore.getEnvTypeStore(envTypeId);
  }

  render() {
    const store = this.getEnvTypeStore();
    let content = null;

    if (isStoreError(store)) {
      content = this.renderError(store.error);
    } else if (isStoreLoading(store)) {
      content = (
        <Placeholder>
          <Placeholder.Line />
        </Placeholder>
      );
    } else if (isStoreReady(store)) {
      content = store.envType.name || 'Not provided';
    } else {
      content = null;
    }

    return content;
  }

  renderError(error) {
    const defaultMessage = 'Hmm... something went wrong';
    const rawMessage = error || defaultMessage;
    const message = _.isString(rawMessage) ? rawMessage : _.get(rawMessage, 'message', defaultMessage);

    return (
      <Popup
        trigger={
          <Label size="mini" basic color="red">
            Show Error
          </Label>
        }
        basic
      >
        <div className="color-red">
          <p>An error occurred while retrieving the workspace type information.</p>
          <p>The system returned this error message:</p>
          <p>{message}</p>
        </div>
      </Popup>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentTypeName, {
  envTypeId: computed,
  envTypesStore: computed,
});

export default inject('envTypesStore')(withRouter(observer(ScEnvironmentTypeName)));
