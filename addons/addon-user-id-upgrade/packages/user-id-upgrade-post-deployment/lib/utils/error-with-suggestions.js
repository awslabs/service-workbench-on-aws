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

class ErrorWithSuggestions extends Error {
  constructor(message, suggestions = []) {
    super();
    this.hasSuggestions = true;
    this._message = message;
    this.suggestions = suggestions;
  }

  get message() {
    const parts = [];
    const suggestions = _.map(this.suggestions, msg => `- ${msg}`);
    parts.push(this._message);
    if (!_.isEmpty(suggestions)) parts.push(`Suggestions:\n${suggestions.join('\n')}\n`);

    return parts.join('\n\n');
  }

  get messageWithoutSuggestions() {
    return this._message;
  }
}

module.exports = ErrorWithSuggestions;
