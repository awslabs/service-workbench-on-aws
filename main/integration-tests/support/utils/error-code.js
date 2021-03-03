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

const _ = require('lodash');

const errorCode = () => {
  const http = {
    badRequest: 400,
    concurrentUpdate: 400,
    // Make sure you know the difference between forbidden and unauthorized
    // (see https://stackoverflow.com/questions/3297048/403-forbidden-vs-401-unauthorized-http-responses)
    unauthorized: 401,
    invalidCredentials: 401,
    forbidden: 403,
    invalidToken: 403,
    notFound: 404,
    alreadyExists: 400,
    // Used when a conflicting operation is being performed (e.g. updating an item when a newer
    // revision of the same is updated by someone else before that)
    outdatedUpdateAttempt: 409,
    timeout: 408,
    badImplementation: 500,
    internalError: 500,
  };

  return {
    http: {
      status: http,
      code: _.mapValues(http, (ignore, key) => key),
    },
    others: {
      // This is when axios sends a request but does not receive a response
      noResponse: 'noResponse',
      // This is when there is an error forming the axios request object
      incorrectRequest: 'incorrectRequest',
    },
  };
};

module.exports = errorCode();
