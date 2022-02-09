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

const { insertRetrySuggestion } = require('./error-utils');

class CompositeError extends Error {
  constructor() {
    super();
    this.errors = [];
    this.compositeError = true;
  }

  addError(error) {
    this.errors.push(error);
    return this;
  }

  get hasErrors() {
    return !_.isEmpty(this.errors);
  }

  get message() {
    const parts = [];
    const messages = _.map(this.getMessages(), msg => `- ${msg}`);
    const suggestions = this.getSuggestions();

    parts.push(`Error(s):\n${messages.join('\n')}`);
    if (!_.isEmpty(suggestions)) parts.push(`Suggestions:\n${suggestions.join('\n')}\n`);

    return parts.join('\n\n');
  }

  getMessages() {
    const messages = [];

    _.forEach(this.errors, error => {
      if (error.compositeError) {
        messages.push(...error.getMessages());
      } else if (error.hasSuggestions) {
        messages.push(error.messageWithoutSuggestions);
      } else {
        messages.push(error.message);
      }
    });

    return messages;
  }

  getSuggestions() {
    const suggestions = [];
    _.forEach(this.errors, error => {
      if (error.compositeError) {
        suggestions.push(...error.getSuggestions());
      }
      if (error && error.hasSuggestions) {
        suggestions.push(...error.suggestions);
      }
    });

    return insertRetrySuggestion(_.uniq(suggestions));
  }

  getRoots() {
    const roots = [];
    _.forEach(this.errors, error => {
      if (error.compositeError) {
        roots.push(...error.getRoots());
      } else {
        roots.push(error);
      }
    });

    return roots;
  }
}

module.exports = CompositeError;
