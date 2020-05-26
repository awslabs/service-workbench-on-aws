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

import { logout } from '../helpers/api';

/**
 * Called when user attempts to login explicitly (i.e., when the user explicitly initiates the login process).
 * Note that this method is ONLY invoked during explicit login initiation. For example, if the user has logged in before
 * and during the application initialization, the application detects the login automatically (due to presence of the
 * authorization token in local storage or url etc) this method is NOT called.
 *
 * Also, this method is called upon login attempt BEFORE the login process is actually complete.
 *
 * @returns {Promise<void>}
 */
async function loginInitiated() {
  // No-op at the moment
}

/**
 * Called when the application detects that the user has logged in explicitly or implicitly.
 * Note that this is called even for implicit login detection. For example, if the user has logged in before and during
 * the application initialization, the application detects login automatically (due to presence of the authorization token
 * in local storage or url etc) this method is still called.
 *
 * Also, this method is called AFTER login is detected i.e., after the login process is complete.
 *
 * @param explicitLogin A flag indicating whether the login was detected as a result of explicit login attempt.
 * This flag will NOT be passed in situations where the application cannot determine with certainty if the detected login
 * was a result of explicit login or implicit login.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function loginDetected({ explicitLogin } = {}) {
  // No-op at the moment
}

/**
 * Called when user attempts to logout explicitly (i.e., when the user explicitly initiates the logout process).
 * Note that this method is only invoked during explicit logout initiation. For example, if the user has logged out before
 * and during the application initialization, the application detects that the user has logged out (due to absence of the
 * authorization token in local storage and url etc) this method is NOT called.
 *
 * @param autoLogout A flag indicating whether the logout was explicitly initiated due to an auto-logout action.
 * For example, if the application explicitly initiates an auto-logout sequence after detecting user inactivity for
 * certain period.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function logoutInitiated({ autoLogout } = {}) {
  // Call the logout API
  await logout();
}

/**
 * Called when the application detects that the user has logged out explicitly or implicitly.
 * Note that this is called even for implicit logout detection. For example, if the user has logged out before
 * and during the application initialization, the application detects that the user has logged out (due to absence of the
 * authorization token in local storage and url etc) this method is still called.
 * (In this sense the "log out detection" is more of "log in NOT detected")
 *
 * Also, this method is called AFTER logout is detected i.e., after the logout process is complete
 * (and the authorization token(s) have been cleared from memory or local storage).
 *
 * @param explicitLogout A flag indicating whether the logout was detected as a result of explicit logout attempt.
 * This flag will NOT be passed in situations where the application cannot determine with certainty if the detected logout
 * was a result of explicit logout or implicit logout.
 * @param autoLogout A flag indicating whether the logout was explicitly initiated due to an auto-logout action.
 * For example, if the application explicitly initiates an auto-logout sequence after detecting user inactivity for
 * certain period.
 * This flag will NOT be passed in situations where the application cannot determine with certainty if the detected logout
 * was a result of explicit auto-logout or implicit logout.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function logoutDetected({ explicitLogout, autoLogout } = {}) {
  // No-op at the moment
}

const plugin = {
  loginInitiated,
  loginDetected,

  logoutInitiated,
  logoutDetected,
};

export default plugin;
