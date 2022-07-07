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

const codes = ['apiError', 'notFound', 'badRequest', 'tokenExpired', 'incorrectImplementation', 'timeout'];

const boom = {
  error: (friendlyOrErr, code, friendly = '') => {
    if (_.isString(friendlyOrErr)) {
      const e = new Error(friendlyOrErr);
      e.isBoom = true;
      e.code = code;
      e.friendly = friendlyOrErr; // the friendly argument is ignored and friendlyOrErr is used instead
      return e;
    }
    if (_.isError(friendlyOrErr)) {
      friendlyOrErr.code = code; // eslint-disable-line no-param-reassign
      friendlyOrErr.isBoom = true; // eslint-disable-line no-param-reassign
      friendlyOrErr.friendly = friendly || _.startCase(code);
      return friendlyOrErr;
    }

    // if we are here, it means that the msgOrErr is an object
    const err = new Error(JSON.stringify(friendlyOrErr));
    err.isBoom = true;
    err.code = code;
    err.friendly = friendly || _.startCase(code);

    return err;
  },
};

// inject all the codes array elements as properties for the boom
// example 'apiError' injected => produces boom.apiError(errOrFriendlyMsg, friendlyMsg)
// then you can call boom.apiError(err, 'Error fetching user info')
codes.forEach(code => {
  boom[code] = (errOrFriendlyMsg, friendlyMsg) => boom.error(errOrFriendlyMsg, code, friendlyMsg);
});

const isNotFound = error => {
  return _.get(error, 'code') === 'notFound';
};

const isTokenExpired = error => {
  return _.get(error, 'code') === 'tokenExpired';
};

const isForbidden = error => {
  return _.get(error, 'code') === 'forbidden';
};

const isAlreadyExists = error => {
  return _.get(error, 'code') === 'alreadyExists';
};

export { boom, isNotFound, isTokenExpired, isForbidden, isAlreadyExists };
