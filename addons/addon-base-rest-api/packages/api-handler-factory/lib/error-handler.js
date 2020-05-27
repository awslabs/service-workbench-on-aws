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

const logError = console.error; // eslint-disable-line no-console

module.exports = () => (err, req, res, next) => {
  if (!_.isError(err)) {
    next();
    return;
  }

  const httpStatus = _.get(err, 'status', 500);

  // see https://github.com/dougmoscrop/serverless-http/blob/master/docs/ADVANCED.md
  const requestId = _.get(req, 'x-request-id', '');
  const code = _.get(err, 'code', 'UNKNOWN');
  const root = _.get(err, 'root');
  const safe = _.get(err, 'safe', false);

  if (httpStatus >= 500) {
    // we print the error only if it is an internal server error
    if (root) logError(root);
    logError(err);
  }
  const errorMessage = err.message;

  const responseBody = {
    requestId,
    code,
    // if there is error message and if it is safe to include then include it in http response
    message: safe && errorMessage ? errorMessage : 'Something went wrong',
  };
  const payload = err.payload;
  // if there is error payload object and if it is safe to include then include it in http response
  if (safe && payload) {
    responseBody.payload = payload;
  }

  res.set('X-Request-Id-2', requestId);
  res.status(httpStatus).json(responseBody);
};
