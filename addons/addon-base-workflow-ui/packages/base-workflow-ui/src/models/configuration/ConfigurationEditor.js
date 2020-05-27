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
import { types, getSnapshot, applySnapshot } from 'mobx-state-tree';

import { createForm } from '@aws-ee/base-ui/dist/helpers/form';
import { InputManifest, toMobxFormFields, isConditionTrue } from '@aws-ee/base-ui/dist/models/forms/InputManifest';

// ==================================================================
// ConfigurationEditor
// ==================================================================
const ConfigurationEditor = types
  .model('ConfigurationEditor', {
    currentSectionIndex: 0, // IMPORTANT section index start from 0 not 1
    review: false,
    inputManifest: types.maybe(InputManifest),
    configuration: types.optional(
      types.map(types.union(types.null, types.undefined, types.integer, types.number, types.boolean, types.string)),
      {},
    ),
    mode: types.optional(types.enumeration('Mode', ['create', 'edit']), 'create'), // mode - either "create" or "edit"
  })

  .volatile((_self) => ({
    originalConfig: undefined,
    originalSectionConfig: undefined, // the key/value object for the original section config after next()
  }))

  .actions(() => ({
    // I had issues using runInAction from mobx
    // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
    runInAction(fn) {
      return fn();
    },
  }))

  .actions((self) => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    // If the value of a form field is an object, then make the value a json string instead
    const normalizeForm = (obj) => {
      return _.transform(
        obj,
        (result, value, key) => {
          result[key] = _.isObject(value) ? JSON.stringify(value) : value;
        },
        {},
      );
    };

    // Returns a key/value object for configuration keys that are part of the given input manifest section
    const getSectionConfig = (inputManifestSection) => {
      const config = {};
      const section = inputManifestSection;
      if (section === undefined) return config;
      const flattened = self.inputManifest.getSectionFlattened(section) || [];
      flattened.forEach((item) => {
        const key = item.name;
        if (self.configuration.has(key)) config[key] = _.cloneDeep(self.configuration.get(key));
      });

      return config;
    };

    const resetOriginalSectionConfig = () => {
      self.originalSectionConfig = getSectionConfig(self.inputManifestSection);
    };

    // Returns all config keys (if any) that belong to input manifest sections after the given index
    const configKeysAfter = (index) => {
      const sections = _.slice(_.get(self.inputManifest, 'sections', []), Math.max(index + 1, 0));
      const keys = [];
      _.forEach(sections, (section) => {
        const config = getSectionConfig(section);
        const configKeys = _.keys(config) || [];
        if (!_.isEmpty(configKeys)) keys.push(...configKeys);
      });

      return keys;
    };

    return {
      afterCreate() {
        // We keep the original values of the configuration object so that when we do cancel, we simply restore the original copy
        self.originalConfig = getSnapshot(self.configuration);
        resetOriginalSectionConfig();
      },

      cleanup() {
        superCleanup();
      },

      next(form) {
        const configuration = self.configuration;
        configuration.merge(normalizeForm(form.values()));

        const changed = !_.isEqual(self.originalSectionConfig, getSectionConfig(self.inputManifestSection));
        const keysAfter = configKeysAfter(self.currentSectionIndex);
        const nextSectionIndex = self.nextSectionIndex;
        const before = self.currentSectionIndex;

        if (nextSectionIndex !== -1) self.currentSectionIndex = nextSectionIndex;
        const after = self.currentSectionIndex;

        resetOriginalSectionConfig();

        // If the configuration keys changed, then it is time to clear all configuration keys (if any) after the current section
        // In case of edit mode, do not clear any section (we need to pre-populate all sections with existing values)
        if (!self.isEditMode && changed) {
          _.forEach(keysAfter, (key) => {
            self.configuration.delete(key);
          });
        }

        // If the section index didn't move forward, it means that we don't have any more sections
        // for input and it is time to show the review content
        self.review = before === after;
      },

      previous(_form) {
        if (self.review) {
          self.review = false;
          return;
        }
        // const configuration = self.configuration;
        // configuration.merge(normalizeForm(form.values()));
        const previousSectionIndex = self.previousSectionIndex;
        if (previousSectionIndex !== -1) self.currentSectionIndex = previousSectionIndex;
        resetOriginalSectionConfig();
      },

      clearConfigs() {
        self.configuration.clear();
      },

      clearSectionConfigs() {
        // We only clear configuration keys that belong to the current section
        if (self.empty) {
          self.configuration.clear();
          return;
        }

        const section = self.inputManifestSection;
        if (section === undefined) return;
        const flattened = self.inputManifest.getSectionFlattened(section) || [];
        flattened.forEach((item) => {
          self.configuration.delete(item.name);
        });
      },

      applyChanges() {
        self.originalConfig = getSnapshot(self.configuration);
      },

      cancel() {
        self.review = false;
        self.currentSectionIndex = 0;
        if (self.originalConfig) {
          applySnapshot(self.configuration, self.originalConfig);
        }

        resetOriginalSectionConfig();
      },

      restart() {
        self.cancel();
      },
    };
  })

  .views((self) => ({
    get isEditMode() {
      return self.mode === 'edit';
    },

    get inputManifestSection() {
      if (self.inputManifest === undefined) return undefined;
      const sections = self.inputManifest.sections;
      const index = self.currentSectionIndex;
      if (index > self.totalSections) return undefined;
      if (index >= sections.length) return undefined;
      return sections[index];
    },

    // A list of objects, where each object represents a configuration name/entry that is not undefined
    // [ {name: 'xyz', title: '...', value: 'true', etc}, {name: 'abc', title: '...', value: 'something', etc}, ... ]
    get definedConfigList() {
      if (self.inputManifest === undefined) return [];
      const inputEntries = self.inputManifest.flattened;
      const configMap = self.configuration;
      const list = [];
      _.forEach(inputEntries, (entry) => {
        let value = configMap.get(entry.name);
        if (_.isUndefined(value)) value = entry.value;
        if (!_.isUndefined(value)) list.push({ ...entry, value });
      });

      return list;
    },

    // A map of all names in inputManifest with their values from the configuration object if they exist
    // or from the inputManifest if they exist, otherwise undefined is given as the value for the key
    // An example of returned object shape: { 'configName': 'demo', 'doYouWantThis': undefined }
    get merged() {
      const inputEntries = self.inputManifest.flattened;
      const map = {};
      _.forEach(inputEntries, (entry) => {
        map[entry.name] = entry.value;
      });

      /* eslint-disable no-restricted-syntax, no-unused-vars */
      for (const [key, value] of self.configuration.entries()) {
        map[key] = value;
      }
      /* eslint-enable no-restricted-syntax, no-unused-vars */

      return map;
    },

    get formFields() {
      const index = self.currentSectionIndex;
      if (self.totalSections < index) return [];
      const input = self.inputManifestSection;
      if (_.isUndefined(input)) return [];

      return toMobxFormFields(input.children, self.merged);
    },

    get form() {
      return createForm(self.formFields);
    },

    get totalSections() {
      if (self.inputManifest === undefined) return 0;
      return self.inputManifest.sections.length;
    },

    get hasNext() {
      return self.nextSectionIndex !== -1 && !self.review;
    },

    get hasPrevious() {
      return self.previousSectionIndex !== -1 || self.review;
    },

    // Returns the next section index
    // if the current section is the last section, return -1
    // walk through the remaining sections and return the index of the first one
    // that has condition === true, otherwise return -1
    get nextSectionIndex() {
      if (self.totalSections < self.currentSectionIndex) return -1;
      if (self.inputManifest === undefined) return -1;
      const sections = self.inputManifest.sections;
      const merged = self.merged;
      let found = false;
      let index = self.currentSectionIndex + 1;

      while (!found && index < self.totalSections) {
        const entry = sections[index];
        found = isConditionTrue(entry.condition, merged);
        if (!found) index += 1;
      }

      return found ? index : -1;
    },

    // Returns the previous section index
    // if the current section is 0, return -1
    // walk through the previous sections and return the index of the first one
    // that has condition === true, otherwise return -1
    get previousSectionIndex() {
      if (self.currentSectionIndex === 0) return -1;
      const sections = self.inputManifest.sections;
      const merged = self.merged;
      let found = false;
      let index = self.currentSectionIndex - 1;

      while (!found && index >= 0) {
        const entry = sections[index];
        found = isConditionTrue(entry.condition, merged);
        if (!found) index -= 1;
      }

      return found ? index : -1;
    },

    get sectionsTitles() {
      const sections = self.inputManifest.sections;
      return _.map(sections, (index) => index.title);
    },

    get empty() {
      if (self.inputManifest === undefined) return true;
      return self.inputManifest.empty;
    },
  }));

// Note: Do NOT register ConfigurationEditor in the global context

export default ConfigurationEditor;
