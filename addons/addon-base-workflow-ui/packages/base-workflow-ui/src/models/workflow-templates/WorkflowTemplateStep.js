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
import { types, getEnv, getParent, applySnapshot, getSnapshot } from 'mobx-state-tree';

import { StepTemplateVersion } from '../workflow-step-templates/StepTemplate';

const titles = {
  title: 'Title',
  desc: 'Description',
  skippable: 'Skip this step if pervious steps failed',
};

const supportedPropsOverrideKeys = ['title', 'desc', 'skippable'];

// ==================================================================
// PropsOverrideOption
// ==================================================================
const PropsOverrideOption = types
  .model('PropsOverrideOption', {
    allowed: types.optional(types.array(types.string), []),
  })
  .actions((self) => ({
    setAllowed(allowed = []) {
      self.allowed.replace(allowed);
    },
  }))
  .views((self) => ({
    get overrideSummaryRows() {
      const canOverride = (prop) => self.allowed.includes(prop);

      const result = [
        { title: titles.title, allowed: canOverride('title'), name: 'title' },
        { title: titles.desc, allowed: canOverride('desc'), name: 'desc' },
        { title: titles.skippable, allowed: canOverride('skippable'), name: 'skippable' },
      ];

      _.forEach(self.allowed, (prop, index) => {
        if (supportedPropsOverrideKeys.includes(prop)) return;
        result.push({ title: prop, allowed: true, name: `${index}-${prop}` });
      });

      return result;
    },
  }));

// ==================================================================
// ConfigOverrideOption
// ==================================================================
const ConfigOverrideOption = types
  .model('ConfigOverrideOption', {
    allowed: types.optional(types.array(types.string), []),
  })
  .actions((self) => ({
    setAllowed(allowed = []) {
      self.allowed.replace(allowed);
    },
  }))
  .views((self) => ({
    get overrideSummaryRows() {
      const result = _.cloneDeep(getParent(self).configSummaryRows || []);
      const map = _.keyBy(result, 'name');
      self.allowed.forEach((key) => {
        const entry = map[key];
        if (entry !== undefined) {
          entry.allowed = true;
        } else {
          result.push({ name: key, allowed: true });
        }
      });

      return result;
    },
  }));

// ==================================================================
// WorkflowTemplateStep
// ==================================================================
const WorkflowTemplateStep = types
  .model('WorkflowTemplateStep', {
    id: '',
    stepTemplateId: '',
    stepTemplateVer: types.maybeNull(types.number),
    title: types.maybe(types.string),
    desc: types.maybe(types.string),
    propsOverrideOption: types.optional(PropsOverrideOption, {}),
    configOverrideOption: types.optional(ConfigOverrideOption, {}),
    stepTemplate: StepTemplateVersion,
    skippable: types.maybe(types.boolean),
    defaults: types.optional(
      types.map(types.union(types.null, types.undefined, types.integer, types.number, types.boolean, types.string)),
      {},
    ),
  })
  .actions((self) => ({
    afterCreate() {
      if (_.isEmpty(self.id))
        console.warn(`There is no id provided for this workflow template step`, getSnapshot(self));
    },

    setDesc(desc) {
      if (desc === self.stepTemplate.desc) self.desc = undefined;
      else self.desc = desc;
    },

    setTitle(title) {
      if (title === self.stepTemplate.title) self.title = undefined;
      else self.title = title;
    },

    setDefaults(defaults = {}) {
      self.defaults.replace(defaults);
    },

    setSkippable(skippable) {
      self.skippable = skippable;
    },

    setConfigOverrideOption(option) {
      applySnapshot(self.configOverrideOption, option);
    },

    setPropsOverrideOption(option) {
      applySnapshot(self.propsOverrideOption, option);
    },
  }))

  .views((self) => ({
    get templateId() {
      return self.stepTemplateId;
    },

    get templateVer() {
      return self.stepTemplateVer;
    },

    get derivedTitle() {
      return self.title || self.stepTemplate.title;
    },

    get derivedDesc() {
      return self.desc || self.stepTemplate.desc;
    },

    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.derivedDesc, self.assets); // TODO declare assets
    },

    get propertyOverrideSummaryRows() {
      if (_.isNil(self.propsOverrideOption)) return [];
      return self.propsOverrideOption.overrideSummaryRows;
    },

    get propertySummaryRows() {
      return [
        {
          title: titles.skippable,
          value: self.skippable,
        },
      ];
    },

    get configSummaryRows() {
      // First, we build a map of all the input manifest entries
      // Then, for entries where we actually have a config value in the 'defaults', we
      // populate the value attribute in the entry.
      const inputManifest = self.stepTemplate.inputManifest;

      // We use 'additional' to keep track of entries that was not part of the inputManifest but yet there is a key in 'configs' for it.
      // The order of the rows might be useful, so we try to preserve it by keeping track of additional
      const additional = [];
      let flattened = [];
      let map = {};

      if (inputManifest) {
        flattened = _.cloneDeep(inputManifest.flattened || []);
        map = _.keyBy(flattened, 'name');
      }

      /* eslint-disable no-restricted-syntax, no-unused-vars */
      for (const [k, v] of self.defaults) {
        let entry = map[k];
        if (entry === undefined) {
          entry = { name: k };
          additional.push(entry);
        }
        entry.value = v;
        map[k] = entry;
      }
      /* eslint-enable no-restricted-syntax, no-unused-vars */

      return [...flattened, ...additional];
    },

    get configOverrideSummaryRows() {
      if (_.isNil(self.configOverrideOption)) return [];
      return self.configOverrideOption.overrideSummaryRows;
    },
  }));

export { WorkflowTemplateStep, PropsOverrideOption, ConfigOverrideOption, supportedPropsOverrideKeys };
