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

import App from '../App';
import AutoLogout from '../parts/AutoLogout';
import ForceLogout from '../parts/ForceLogout';

// eslint-disable-next-line no-unused-vars
function getAppComponent({ location, appContext }) {
  return App;
}

// eslint-disable-next-line no-unused-vars
function getAutoLogoutComponent({ location, appContext }) {
  return AutoLogout;
}

// eslint-disable-next-line no-unused-vars
function getForceLogoutComponent({ location, appContext }) {
  return ForceLogout;
}

const plugin = {
  getAppComponent,
  getAutoLogoutComponent,
  getForceLogoutComponent,
};

export default plugin;
