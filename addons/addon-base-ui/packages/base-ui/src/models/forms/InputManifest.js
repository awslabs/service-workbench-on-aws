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
import { types, getSnapshot } from 'mobx-state-tree';

// ==================================================================
// InputManifest
// ==================================================================
const InputManifest = types
  .model('InputManifest', {
    sections: types.optional(types.array(types.frozen()), []),
  })
  .actions((_self) => ({}))

  .views((self) => ({
    // An array of all the input entries (excluding non-interactive ones). This is a convenient method that
    // traverses the whole input manifest tree.
    // [ { name, title, ... }, { name, title, ...} ]
    get flattened() {
      return _.flatten(_.map(self.sections, (section) => findEntries(section.children)));
    },

    get names() {
      return _.map(self.flattened, (entry) => entry.name);
    },

    get empty() {
      return self.flattened.length === 0;
    },

    getSectionFlattened(section = {}) {
      return _.flatten(findEntries(section.children));
    },
  }));

// ==================================================================
// Helpers
// ==================================================================

// Does the entry represent an input that will interact with the user
function isInteractive(entry) {
  if (_.isUndefined(entry)) return false;
  return _.isNil(entry.nonInteractive) || entry.nonInteractive === false;
}

// Condition is true if it is empty/undefined or if the lodash expression evaluates to the string "true"
function isConditionTrue(condition, config) {
  if (_.isEmpty(condition)) return true;
  return _.template(condition)(config) === 'true';
}

// Given an inputManifestEntry returns a object that contains all the supported mobx form field props
// For a list of all mobx form field props see https://foxhound87.github.io/mobx-react-form/docs/fields/defining-flat-fields/unified-properties.html
function toMobxFormFieldProps(entry, value) {
  if (!isInteractive(entry)) return {};
  const map = {};
  const add = (key, val) => {
    if (!_.isUndefined(val)) map[key] = val;
  };
  const { name, title, placeholder, rules, extra = {}, desc, disabled, options, yesLabel, noLabel } = entry;

  add('name', name);
  add('value', _.isUndefined(value) ? entry.default : value);
  add('label', title);
  add('placeholder', placeholder);
  add('rules', rules);
  add('default', _.isUndefined(entry.default) ? value : entry.default);
  add('extra', { ..._.cloneDeep(extra), explain: desc, options, yesLabel, noLabel });
  add('disabled', disabled);

  return map;
}

// Recursive function
// input = an array of the input manifest section children or input manifest entry children
// config = all names in inputManifest and their values (if they exist)
function toMobxFormFields(input = [], config) {
  const result = [];
  if (input.length === 0) return result;
  const queue = input.slice();

  while (queue.length > 0) {
    const entry = queue.shift();
    const name = entry.name;
    if (isInteractive(entry) && isConditionTrue(entry.condition, config)) {
      const value = config[name];
      const field = toMobxFormFieldProps(entry, value);
      result.push(field);
      const children = entry.children;
      if (_.isObject(children)) {
        const fields = toMobxFormFields(children, config); // recursive call
        if (fields.length > 0) {
          result.push(...fields);
        }
      }
    }
  }

  return result;
}

// Given an instance of inputManifest, apply markdown on all 'desc' props and return
// a new json object (NOT an instance of inputManifest)
function applyMarkdown({ inputManifest, showdown, assets = {} }) {
  const copy = _.cloneDeep(getSnapshot(inputManifest));

  function transform(obj) {
    if (_.isNil(obj)) return obj;
    if (_.isArray(obj))
      return _.map(obj, (item) => {
        return transform(item);
      });

    if (!_.isObject(obj)) return obj;
    const keys = Object.keys(obj);

    keys.forEach((key) => {
      if (key !== 'desc') {
        obj[key] = transform(obj[key]);
        return;
      }
      const desc = obj[key];
      if (_.isNil(desc)) return;
      obj.desc = showdown.convert(desc, assets);
    });

    return obj;
  }

  copy.sections = transform(copy.sections);

  return copy;
}

// Given an array of input entries, visit each one of them by passing the item
// to the visitFn
function visit(input = [], visitFn = (obj) => obj) {
  const result = [];
  if (input.length === 0) return result;
  const queue = input.slice();

  while (queue.length > 0) {
    const entry = queue.shift();
    result.push(visitFn(entry));
    const children = entry.children;
    if (_.isObject(children)) {
      const entries = visit(children, visitFn); // recursive call
      if (entries.length > 0) {
        entries.forEach((field) => {
          result.push(visitFn(field));
        });
      }
    }
  }
  return result;
}

// ==================================================================
// Internal Helpers
// ==================================================================

// Find all names with their entries (such as titles). This is a recursive function.
// Returns an array,  [ { name, title, ... }, { name, title, ...} ]
function findEntries(input = []) {
  const result = [];
  if (input.length === 0) return result;
  const queue = input.slice();

  while (queue.length > 0) {
    const entry = queue.shift();
    if (isInteractive(entry)) {
      result.push(entry);
    }
    const children = entry.children;
    if (_.isObject(children)) {
      const entries = findEntries(children); // recursive call
      if (entries.length > 0) {
        entries.forEach((field) => {
          result.push(field);
        });
      }
    }
  }
  return result;
}

export { InputManifest, isInteractive, toMobxFormFieldProps, isConditionTrue, toMobxFormFields, applyMarkdown, visit };
