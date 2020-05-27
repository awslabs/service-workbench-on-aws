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

import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate } from 'mobx';
import { withRouter } from 'react-router-dom';
import c from 'classnames';

// expected props
// - user (via props)
// - userDisplayName (via injection)
// - className (via props)
class By extends React.Component {
  get user() {
    return this.props.user;
  }

  get userDisplayNameService() {
    return this.props.userDisplayName;
  }

  render() {
    const user = this.user;
    const displayNameService = this.userDisplayNameService;
    const isSystem = displayNameService.isSystem(user);
    return isSystem ? (
      ''
    ) : (
      <span className={c(this.props.className)}>
        by
        {displayNameService.getDisplayName(user)}
      </span>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(By, {});

export default inject('userDisplayName')(withRouter(observer(By)));
