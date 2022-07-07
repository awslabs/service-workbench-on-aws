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
import { observer } from 'mobx-react';
import { Label } from 'semantic-ui-react';

const UserLabels = props => {
  const { color, className = '', users } = props;

  return (
    <div className={className}>
      {_.map(users, user => (
        <Label key={user.username} color={color} image className="mt1">
          {user.firstName}&nbsp;
          {user.lastName}
          <Label.Detail>
            {user.unknown && `${user.username}??`}
            {!user.unknown && (user.email || user.username)}
          </Label.Detail>
        </Label>
      ))}
    </div>
  );
};

export default observer(UserLabels);
