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

/* eslint-disable no-console */
const _ = require('lodash');

// This function can receive an instance of Error or a string or an object with two properties: msg/message & stack.
// Furthermore, if the error is an instance of Error and has a property 'root' as an object, then this root
// object is expected to have two properties: msg & stack.
//
// This function returns an object with two properties: msg & stack (with stack being trimmed to 300 characters).
function normalizeError(error = {}, { maxStackLength = 300 } = {}) {
  if (_.isString(error) || _.isNil(error)) return { msg: error || 'UnknownError', stack: '' };

  const toMsg = obj => obj.msg || obj.message || 'Unknown Error';
  const toStack = obj => (obj.stack || '').substring(0, maxStackLength);
  const toResult = obj => {
    const output = _.omit({ ...obj, msg: toMsg(obj), stack: toStack(obj) }, ['message']);
    return output;
  };

  console.log(error); // We are printing this here so that the full stack is shown
  if (error instanceof Error) return _.isObject(error.root) ? toResult(error.root) : toResult(error);
  return toResult(error);
}

// Just a function that protects against throwing an error
const catchIfErrorAsync = async fn => {
  try {
    return await fn();
  } catch (error) {
    console.log(error);
    return undefined;
  }
};

const catchIfError = fn => {
  try {
    return fn();
  } catch (error) {
    console.log(error);
    return undefined;
  }
};

module.exports = {
  normalizeError,
  catchIfErrorAsync,
  catchIfError,
};
