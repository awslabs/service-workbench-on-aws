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
import { types, getEnv, applySnapshot, detach, clone } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';
import { generateId } from '@aws-ee/base-ui/dist/helpers/utils';

import { WorkflowTemplateStep } from './WorkflowTemplateStep';

const titles = {
  instanceTtl: 'Time to Live (TTL) for instances of the workflow',
  runSpecSize: 'Runtime lambda size',
  runSpecTarget: 'Runtime target',
  title: 'Title',
  desc: 'Description',
  steps: 'Add, remove, and rearrange steps',
};

const supportedPropsOverrideKeys = ['runSpecSize', 'runSpecTarget', 'instanceTtl', 'title', 'desc', 'steps'];

// ==================================================================
// PropsOverrideOption
// ==================================================================
const PropsOverrideOption = types
  .model('PropsOverrideOption', {
    allowed: types.optional(types.array(types.string), []),
  })
  .views(self => ({
    get overrideSummaryRows() {
      const canOverride = prop => self.allowed.includes(prop);

      const result = [
        { title: titles.steps, allowed: canOverride('steps'), name: 'steps' },
        { title: titles.instanceTtl, allowed: canOverride('instanceTtl'), name: 'instanceTtl' },
        { title: titles.runSpecSize, allowed: canOverride('runSpecSize'), name: 'runSpecSize' },
        { title: titles.runSpecTarget, allowed: canOverride('runSpecTarget'), name: 'runSpecTarget' },
        { title: titles.title, allowed: canOverride('title'), name: 'title' },
        { title: titles.desc, allowed: canOverride('desc'), name: 'desc' },
      ];

      _.forEach(self.allowed, prop => {
        if (supportedPropsOverrideKeys.includes(prop)) return;
        result.push({ title: prop, allowed: true });
      });

      return result;
    },

    canOverride(prop) {
      return self.allowed.includes(prop);
    },
  }));

// ==================================================================
// RunSpec
// ==================================================================
const RunSpec = types
  .model('RunSpec', {
    size: '',
    target: '',
  })
  .views(self => ({
    get propertySummaryRows() {
      return [
        { title: titles.runSpecSize, value: self.size },
        { title: titles.runSpecTarget, value: self.target },
      ];
    },
  }));

// ==================================================================
// WorkflowTemplateVersion
// ==================================================================
const WorkflowTemplateVersion = types
  .model('WorkflowTemplateVersion', {
    id: '',
    v: types.number,
    rev: types.maybeNull(types.number),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    title: '',
    desc: '',
    instanceTtl: types.maybeNull(types.number),
    runSpec: RunSpec,
    propsOverrideOption: types.maybe(PropsOverrideOption),
    selectedSteps: types.optional(types.array(WorkflowTemplateStep), []),
  })
  .actions(self => ({
    setWorkflowTemplateVersion(template) {
      applySnapshot(self, template);
    },

    setTitle(title) {
      self.title = title;
    },

    setDescription(desc) {
      self.desc = desc;
    },

    setInstanceTtl(value) {
      let answer = null;
      if (_.isString(value)) {
        const parsed = parseInt(value, 10);
        if (_.isNaN(parsed)) answer = null;
        else answer = parsed;
      } else if (_.isNumber(value)) {
        answer = value;
      }

      self.instanceTtl = answer;
    },

    setRunSpec(runSpec) {
      applySnapshot(self.runSpec, runSpec);
    },

    setPropsOverrideOption(option) {
      applySnapshot(self.propsOverrideOption, option);
    },

    reinsertStep(currentIndex, targetIndex) {
      const current = self.selectedSteps[currentIndex];

      detach(current);
      self.selectedSteps.splice(targetIndex, 0, current);
    },

    removeStep(idOrStep) {
      const step = _.isString(idOrStep) ? self.getStep(idOrStep) : idOrStep;
      self.selectedSteps.remove(step);
    },

    addStep(step) {
      const { id, v, skippable, title, desc } = step;
      const workflowStep = WorkflowTemplateStep.create(
        {
          id: generateId('wt-step'),
          stepTemplateId: id,
          stepTemplateVer: v,
          title,
          desc,
          skippable,
          stepTemplate: clone(step),
        },
        getEnv(self),
      );

      self.selectedSteps.push(workflowStep);

      return workflowStep;
    },
  }))

  .views(self => ({
    getStep(id) {
      return _.find(self.selectedSteps, step => step.id === id);
    },

    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc, self.assets); // TODO declare assets
    },

    get system() {
      return self.createdBy === '_system_';
    },

    get propertySummaryRows() {
      return [
        {
          title: titles.instanceTtl,
          value: self.instanceTtl,
        },
        ...self.runSpec.propertySummaryRows,
      ];
    },

    get propertyOverrideSummaryRows() {
      if (_.isNil(self.propsOverrideOption)) return [];
      return self.propsOverrideOption.overrideSummaryRows;
    },

    // A workflow template can always rearrange its steps, don't confuse this with 'canWorkflowRearrangeSteps'
    get canRearrangeSteps() {
      return true;
    },

    get canWorkflowRearrangeSteps() {
      return self.canWorkflowOverrideProp('steps');
    },

    canWorkflowOverrideProp(prop) {
      return self.propsOverrideOption.canOverride(prop);
    },
  }));

// ==================================================================
// WorkflowTemplate
// ==================================================================
const WorkflowTemplate = types
  .model('WorkflowTemplate', {
    id: types.identifier,
    versions: types.optional(types.array(WorkflowTemplateVersion), []),
  })
  .actions(self => ({
    setWorkflowTemplate(template) {
      // we try to preserve any existing version objects and update their content instead
      const mapOfExisting = _.keyBy(self.versions, version => version.v.toString());
      const processed = [];

      _.forEach(template.versions, templateVersion => {
        const existing = mapOfExisting[templateVersion.v];
        if (existing) {
          existing.setWorkflowTemplateVersion(templateVersion);
          processed.push(existing);
        } else {
          processed.push(WorkflowTemplateVersion.create(templateVersion));
        }
      });

      self.versions.replace(processed);
    },
  }))

  .views(self => ({
    get latest() {
      // we loop through all 'v' numbers and pick the template with the largest 'v' value
      let largestVersion = self.versions[0];
      _.forEach(self.versions, version => {
        if (version.v > largestVersion.v) {
          largestVersion = version;
        }
      });
      return largestVersion;
    },

    getVersion(v) {
      return _.find(self.versions, ['v', v]);
    },

    get versionNumbers() {
      return _.map(self.versions, version => version.v);
    },
  }));

export { WorkflowTemplate, WorkflowTemplateVersion, RunSpec };
