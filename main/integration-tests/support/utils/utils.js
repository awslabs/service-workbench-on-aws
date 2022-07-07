/* eslint-disable no-console */
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

const path = require('path');
const _ = require('lodash');

// remove the "end" string from "str" if it exists
function chopRight(str = '', end = '') {
  if (!_.endsWith(str, end)) return str;
  return str.substring(0, str.length - end.length);
}

// remove the "start" string from "str" if it exists
function chopLeft(str = '', start = '') {
  if (!_.startsWith(str, start)) return str;
  return str.substring(start.length);
}

/**
 * A normalized study folder (a.k.a prefix) should have no leading forward slash but should have a trailing
 * forward slash. If the study is the whole bucket, then the a normalized study folder should be '/'.
 */
function normalizeStudyFolder(str = '') {
  // First we want to make sure that all '../' are resolved now.
  // Note: path.resolve, will also remove any trailing forward slashes
  let resolved = path.resolve('/', str);

  // If the whole path is just '/' then return it as is. This is the case when the whole bucket might be the study
  if (resolved === '/') return '/';

  // Remove the leading forward slash if present
  resolved = chopLeft(resolved, '/');
  // Add a trailing forward slash if missing
  return _.endsWith(resolved, '/') ? resolved : `${resolved}/`;
}

/**
 * Runs the provided async function and prints the error object (if any) to the console, it does NOT rethrow
 * the error
 */
async function run(fn) {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

module.exports = {
  chopRight,
  chopLeft,
  normalizeStudyFolder,
  run,
};
