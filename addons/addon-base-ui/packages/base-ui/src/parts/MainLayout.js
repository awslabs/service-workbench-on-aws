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
import { decorate, action } from 'mobx';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Menu, Icon, Image } from 'semantic-ui-react';

import { createLink } from '../helpers/routing';
import { displayError } from '../helpers/notification';
import { branding, versionAndDate } from '../helpers/settings';

// expected props
// - userStore (via injection)
class MainLayout extends React.Component {
  goto = pathname => () => {
    const location = this.props.location;
    const link = createLink({
      location,
      pathname,
    });

    this.props.history.push(link);
  };

  handleLogout = async event => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await this.props.authentication.logout();
    } catch (error) {
      displayError(error);
    }
  };

  getMenuItems() {
    return this.props.menuItems || [];
  }

  render() {
    const currentUser = this.props.userStore.user;
    const displayName = currentUser ? currentUser.displayName : 'Not Logged In';
    const pathname = _.get(this.props.location, 'pathname', '');
    const is = value => _.startsWith(pathname, value);

    const itemsArr = this.getMenuItems();
    return [
      <Menu vertical inverted fixed="left" icon="labeled" key="ml1" style={{ overflowY: 'auto' }}>
        <Menu.Item name=" " style={{ height: '40px' }} />
        {_.map(itemsArr, (item, index) => {
          const show = (_.isFunction(item.shouldShow) && item.shouldShow()) || item.shouldShow;
          return (
            show &&
            (item.body ? (
              item.body
            ) : (
              <Menu.Item key={index} active={is(item.url)} onClick={is(item.url) ? undefined : this.goto(item.url)}>
                <Icon name={item.icon} size="mini" />
                <span className="fs-7">{item.title}</span>
              </Menu.Item>
            ))
          );
        })}
      </Menu>,

      <Menu inverted color="black" fixed="top" className="box-shadow zindex-1500" key="ml2">
        <Menu.Item style={{ height: '50px', verticalAlign: 'middle' }}>
          <Image
            size="mini"
            src={this.props.assets.images.logoImage}
            className="mr1"
            style={{ height: '40px', width: 'auto' }}
          />
          <span style={{ paddingLeft: '5px' }}>{branding.main.title}</span>
          <span style={{ paddingLeft: '20px' }}>{versionAndDate}</span>
        </Menu.Item>
        <Menu.Menu position="right">
          <Menu.Item>
            <Icon name="user" /> {displayName}
          </Menu.Item>
          <Menu.Item name="logout" onClick={this.handleLogout} />
        </Menu.Menu>
      </Menu>,
      <div
        className="mainLayout fit animated fadeIn"
        style={{
          paddingTop: '40px',
          paddingLeft: '84px',
          paddingBottom: '100px',
        }}
        key="ml3"
      >
        {this.props.children}
      </div>,
    ];
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(MainLayout, {
  handleLogout: action,
});

export default inject('authentication', 'userStore', 'assets')(withRouter(observer(MainLayout)));
