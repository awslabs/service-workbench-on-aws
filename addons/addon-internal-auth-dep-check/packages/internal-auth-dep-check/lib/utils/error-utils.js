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

const _ = require('lodash');

// Make sure that the 'Retry post deployment' is always the last suggestion
// This function modifies the suggestions array to ensure that the
// 'Retry post deployment' suggestion is the last suggestion on the list
function insertRetrySuggestion(suggestions = []) {
  const text = 'Resolve the above resources blocking upgrade and retry the deployment.';
  _.remove(suggestions, item => item === text);

  suggestions.push(text);

  return suggestions;
}

// A function that knows how to log a composite error
function logError(error, log) {
  // If the error is a composite error, we log all root errors first
  if (error.compositeError) {
    _.forEach(error.getRoots(), root => {
      log.error(root); // The proper way to log an error
      console.error(root); // We log it again here to make it easier to read from the terminal, do NOT do this anywhere else
    });
  }

  // Time to log the error itself
  log.error(error); // The proper way to log an error
  console.error(error); // We log it again here to make it easier to read from the terminal, don't do this anywhere else
}

// function createErrorWithSuggestion(errorMessage, suggestions) {
//   const error = new Error(errorMessage);
//   error.suggestions = suggestions;

//   return new CompositeError().addError(error);
// }

module.exports = {
  insertRetrySuggestion,
  logError,
  //  createErrorWithSuggestion,
};
