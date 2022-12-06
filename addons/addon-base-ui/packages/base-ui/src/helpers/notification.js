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
import toastr from 'toastr';

function displayError(msg, error, timeOut = '20000') {
  toastr.options.escapeHtml = true;
  toastr.error(toMessage(msg, error), 'We have a problem!', { ...toasterErrorOptions, timeOut });
  if (error) console.error(msg, error);
  if (_.isError(msg)) console.error(msg);
}

function displayWarning(msg, error, timeOut = '20000') {
  toastr.options.escapeHtml = true;
  toastr.warning(toMessage(msg, error), 'Warning!', { ...toasterWarningOptions, timeOut });
  if (error) console.error(msg, error);
  if (_.isError(msg)) console.error(msg);
}

function displaySuccess(msg, title = 'Submitted!') {
  toastr.options.escapeHtml = true;
  toastr.success(toMessage(msg), title, toasterSuccessOptions);
}

function displayFormErrors(form) {
  const map = form.errors();
  const lines = [];
  Object.keys(map).forEach(key => {
    if (map[key]) lines.push(map[key]);
  });

  if (lines.length === 0) return displayError('The form submission has a problem.', undefined, 3000);
  const isPlural = lines.length > 1;
  const message = `There ${isPlural ? 'are issues' : 'is an issue'} with the form:`;
  return displayError([message, ...lines], undefined, 3000);
}

function toMessage(msg, error) {
  if (_.isError(msg)) {
    return `${msg.message || msg.friendly} \n;`;
  }

  if (_.isError(error)) {
    return `${msg} - ${error.message} \n;`;
  }

  if (_.isArray(msg)) {
    const messages = msg;
    const size = _.size(messages);

    if (size === 0) {
      return 'Unknown error \n;';
    }
    if (size === 1) {
      return `${messages[0]}\n;`;
    }
    const result = [];
    _.forEach(messages, message => {
      result.push(`${message}\n`);
    });

    return result.join('');
  }

  if (_.isEmpty(msg)) return 'Unknown error \n;';

  return `${msg} \n;`;
}

// For details of options, see https://github.com/CodeSeven/toastr
//
// closeButton:       Enable a close button
// debug:             Emit debug logs to the console
// newestOnTop:       Show newest toast at top or bottom (top is default)
// progressBar:       Visually indicate how long before a toast expires
// positionClass:     CSS position style e.g. toast-top-center, toast-bottom-left
// preventDuplicates: Prevent identical toasts appearing (based on content)
// timeOut:           How long the toast will display without user interaction (ms)
// extendedTimeOut:   How long the toast will display after a user hovers over it (ms)

const toasterErrorOptions = {
  closeButton: true,
  debug: false,
  newestOnTop: true,
  progressBar: true,
  positionClass: 'toast-bottom-right',
  preventDuplicates: true,
  timeOut: '20000', // 1000000
  extendedTimeOut: '50000', // 1000000
};

const toasterWarningOptions = {
  closeButton: true,
  debug: false,
  newestOnTop: true,
  progressBar: true,
  positionClass: 'toast-bottom-right',
  preventDuplicates: true,
  timeOut: '20000', // 1000000
  extendedTimeOut: '50000', // 1000000
};

const toasterSuccessOptions = {
  closeButton: true,
  debug: false,
  newestOnTop: true,
  progressBar: true,
  positionClass: 'toast-bottom-right',
  preventDuplicates: true,
  timeOut: '3000',
  extendedTimeOut: '10000',
};

export { displayError, displayWarning, displaySuccess, displayFormErrors };
