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

const BoomError = require('./boom-error');
const errorCode = require('./error-code');

/**
 * Transforms axios error to a boom error so that we can capture the boom code and payload attributes passed from the
 * server.
 */
function transform(error = {}) {
  // See description of axios error at
  // https://github.com/axios/axios#handling-errors

  let boom;

  if (error.response) {
    // From axios doc:
    // "The request was made and the server responded with a status code"
    // "that falls out of the range of 2xx"
    const response = error.response;
    const status = _.get(response, 'status');
    const code = _.get(response, 'data.code');
    const msg = _.get(
      response,
      'data.message',
      status === 404 ? 'Resource not found' : 'Something went wrong calling the server',
    );
    const payload = _.get(response, 'data.payload');
    const requestPath = _.get(error, 'request.path', '');
    const requestMethod = _.get(error, 'request.method', '');

    boom = new BoomError(msg, code, status);
    boom.request = `${requestMethod} ${requestPath}`;

    if (payload) {
      boom.withPayload(payload);
    }
  } else if (error.request) {
    // From axios doc:
    // "The request was made but no response was received"
    // "`error.request` is an instance of XMLHttpRequest in the browser and an instance of"
    // "http.ClientRequest in node.js"
    boom = new BoomError(error, errorCode.others.noResponse);
  } else {
    // From axios doc:
    // "Something happened in setting up the request that triggered an Error"
    boom = new BoomError(error, errorCode.others.incorrectRequest);
  }

  return boom;
}

module.exports = { transform };
