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

/**
 * An error class that matches its counter part from the server side.
 */
class BoomError extends Error {
  /**
   * @param msg Error message
   * @param code Error code
   * @param status The http status code
   */
  constructor(msg = '', code = 'badImplementation', status = 500) {
    super(_.isError(msg) ? msg.message : _.get(msg, 'message', msg || ''));

    this.boom = true;
    this.code = code;
    this.status = status;
    if (_.isError(msg)) {
      this.root = msg;
    }
  }

  /**
   * A method to add extra payload information to the error. This payload can then be used by
   * the clients to read additional information about the error.
   * @param payload The payload to add to this error
   *
   * @returns {BoomError}
   */
  withPayload(payload) {
    this.payload = payload;
    return this;
  }

  cause(root) {
    this.root = root;
    return this;
  }
}

module.exports = BoomError;
