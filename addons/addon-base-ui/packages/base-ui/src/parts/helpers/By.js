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
