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
          {user.firstName}
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
