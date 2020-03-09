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
import { types, getEnv, getSnapshot } from 'mobx-state-tree';

import {
  PropsOverrideOption,
  ConfigOverrideOption,
  supportedPropsOverrideKeys,
} from '../workflow-templates/WorkflowTemplateStep';

const titles = {
  title: 'Title',
  desc: 'Description',
  skippable: 'Skip this step if pervious steps failed',
};

// ==================================================================
// WorkflowStep
// ==================================================================
const WorkflowStep = types
  .model('WorkflowStep', {
    id: '',
    stepTemplateId: '',
    stepTemplateVer: types.maybeNull(types.number),
    title: types.maybe(types.string),
    desc: types.maybe(types.string),
    propsOverrideOption: types.optional(PropsOverrideOption, {}),
    configOverrideOption: types.optional(ConfigOverrideOption, {}),
    skippable: types.maybe(types.boolean),
    configs: types.optional(
      types.map(types.union(types.null, types.undefined, types.integer, types.number, types.boolean, types.string)),
      {},
    ),
  })
  .actions(self => ({
    afterCreate() {
      if (_.isEmpty(self.id)) console.warn(`There is no id provided for this workflow step`, getSnapshot(self));
    },

    setDesc(desc) {
      self.desc = desc;
    },

    setTitle(title) {
      self.title = title;
    },

    setConfigs(configs = {}) {
      self.configs.replace(configs);
    },

    setSkippable(skippable) {
      self.skippable = skippable;
    },

    // You should only use this method if the workflow step is added manually by the user (when allowed)
    // do not make a WorkflowStep that came from the server as new.
    makeNew() {
      self.propsOverrideOption.setAllowed(_.slice(supportedPropsOverrideKeys));
      const stepTemplate = self.stepTemplate;
      if (!stepTemplate) return;
      const inputManifest = stepTemplate.inputManifest;
      if (!inputManifest) return;
      const names = inputManifest.names;
      self.configOverrideOption.setAllowed(names);
    },
  }))

  .views(self => ({
    get templateId() {
      return self.stepTemplateId;
    },

    get templateVer() {
      return self.stepTemplateVer;
    },

    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc, self.assets); // TODO declare assets
    },

    get stepTemplate() {
      const id = self.stepTemplateId;
      const v = self.stepTemplateVer;
      const stepTemplatesStore = getEnv(self).stepTemplatesStore;
      if (!stepTemplatesStore) return undefined;

      const stepTemplate = stepTemplatesStore.getTemplate(id);
      if (!stepTemplate) return undefined;
      return stepTemplate.getVersion(v);
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
      // Then, for entries where we actually have a config value in the 'configs', we
      // populate the value attribute in the entry.
      const stepTemplate = self.stepTemplate;
      if (stepTemplate === undefined) return [];
      const inputManifest = stepTemplate.inputManifest;

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
      for (const [k, v] of self.configs) {
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
  }));

export default WorkflowStep;
