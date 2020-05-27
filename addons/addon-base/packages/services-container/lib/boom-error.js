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

class BoomError extends Error {
  /**
   * @param msg Error message
   * @param safe A flag indicating if this error's message and its payload are
   * safe to be transferred across system boundaries. If this flag is set to "false"
   * then the code responsible for translating this error information into boundary
   * layer error should NOT include the error's "message" and "payload" in the translated error.
   * For example, if this flag is "false" and if this error is being converted to HTTP response
   * (here, HTTP response represents a boundary layer error) this error's "message" and "payload"
   * should be omitted from the HTTP response body.
   * Note that this flag is a convenience flag for suggestion and the BoomError class itself does
   * not do any enforcement of this flag. The interpretation of this flag is left to the clients of this class.
   * @param code Error code
   * @param status Status code number
   */
  constructor(msg = '', safe = false, code = 'badImplementation', status = 500) {
    super(_.isError(msg) ? msg.message : _.get(msg, 'message', msg || ''));

    this.boom = true;
    this.code = code;
    this.status = status;
    this.safe = safe;
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
