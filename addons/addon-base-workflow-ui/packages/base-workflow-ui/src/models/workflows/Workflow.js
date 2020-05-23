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
import { types, getEnv, applySnapshot, detach } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';
import { generateId, consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { RunSpec } from '../workflow-templates/WorkflowTemplate';
import WorkflowStep from './WorkflowStep';

const titles = {
  instanceTtl: 'Time to Live (TTL) for instances of the workflow',
  runSpecSize: 'Runtime lambda size',
  runSpecTarget: 'Runtime target',
  title: 'Title',
  desc: 'Description',
  steps: 'Add, remove, and rearrange steps',
};

const statusColorMap = {
  // 'not_started': '', // to default to grey
  in_progress: 'orange',
  error: 'red',
  done: 'green',
};

// ==================================================================
// WorkflowAssignment
// ==================================================================
const WorkflowAssignment = types
  .model('WorkflowAssignment', {
    id: '',
    wf: '',
    rev: types.number,
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    triggerType: '',
    triggerTypeData: '',
  })
  .actions(self => ({
    setWorkflowAssignment(assignment) {
      applySnapshot(self, assignment);
    },
  }))

  .views(self => ({
    get system() {
      return self.createdBy.username === '_system_';
    },
  }));

// ==================================================================
// WorkflowInstance
// ==================================================================
const WorkflowInstance = types
  .model('WorkflowInstance', {
    id: types.identifier,
    wfId: '',
    wfVer: types.number,
    ttl: types.maybeNull(types.number),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    msg: '',
    wfStatus: '',
    stStatuses: types.optional(types.frozen(), []),
    runSpec: RunSpec,
    input: types.optional(types.frozen(), {}),
    workflow: types.optional(types.frozen(), {}),
  })
  .actions(self => ({
    setWorkflowInstance(instance) {
      applySnapshot(self, instance);
    },
  }))

  .views(self => ({
    get system() {
      return self.createdBy.username === '_system_';
    },

    // This is the workflow version
    get version() {
      const workflowsStore = getEnv(self).workflowsStore;
      const workflow = workflowsStore.getWorkflow(self.wfId);
      if (!workflow) return undefined;
      return workflow.getVersion(self.wfVer);
    },

    get pending() {
      return self.wfStatus === 'not_started' || self.wfStatus === 'in_progress';
    },

    get statusSummary() {
      const stepSummary = status => {
        const count = _.size(_.filter(self.stStatuses, item => item.status === status));
        return {
          count,
          statusLabel: _.startCase(status),
          statusColor: statusColorMap[status],
        };
      };
      const is = value => self.wfStatus === value;
      const spread = {
        success: is('done'),
        error: is('error'),
        warning: is('in_progress'),
      };

      return {
        statusMsg: self.msg,
        statusLabel: _.startCase(self.wfStatus),
        statusColor: statusColorMap[self.wfStatus],
        stepsSummary: [
          stepSummary('done'),
          stepSummary('error'),
          stepSummary('in_progress'),
          stepSummary('skipped'),
          stepSummary('not_started'),
        ],
        msgSpread: spread,
      };
    },

    get steps() {
      const selectedSteps = self.workflow.selectedSteps || [];
      const getStep = index => _.nth(selectedSteps, index);
      const strip = (pre, msg, color) => {
        if (_.startsWith(msg, pre)) {
          return {
            match: true,
            parsed: msg.substring(pre.length),
            color,
          };
        }
        return {
          match: false,
          parsed: msg,
        };
      };
      const parse = msg => {
        if (_.isEmpty(msg)) return {};
        let item = strip('WARN|||', msg, 'orange');
        if (!item.match) {
          item = strip('ERR|||', msg, 'red');
          if (!item.match) {
            item = strip('INFO|||', msg, 'green');
          }
        }

        return item;
      };
      const result = [];

      _.forEach(self.stStatuses, (stepStatus, index) => {
        const step = getStep(index) || {};
        const msgObj = parse(stepStatus.msg);
        result.push({
          statusMsg: msgObj.parsed,
          statusLabel: _.startCase(stepStatus.status),
          statusColor: msgObj.color || statusColorMap[stepStatus.status],
          stepTemplateId: step.stepTemplateId || 'unknown',
          stepTemplateVer: step.stepTemplateVer,
          title: step.title || 'Not available',
          startTime: stepStatus.startTime,
          endTime: stepStatus.endTime,
        });
      });

      return result;
    },
  }));

// ==================================================================
// WorkflowVersion
// ==================================================================
const WorkflowVersion = types
  .model('WorkflowVersion', {
    id: '',
    v: types.number,
    rev: types.maybe(types.number),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    title: '',
    desc: '',
    instanceTtl: types.maybeNull(types.number),
    runSpec: RunSpec,
    stepsOrderChanged: types.boolean,
    selectedSteps: types.optional(types.array(WorkflowStep), []),
    instancesMap: types.optional(types.map(WorkflowInstance), {}),
    workflowTemplateId: '',
    workflowTemplateVer: types.maybe(types.number),
  })
  .actions(self => ({
    setWorkflowVersion(version) {
      const instancesMap = detach(self.instancesMap); // preserve the instances value
      applySnapshot(self, version);
      self.instancesMap = instancesMap;
    },

    // important "instances" is expected to be an array
    setInstances(instances = []) {
      consolidateToMap(self.instancesMap, instances, (exiting, newItem) => {
        exiting.setWorkflowInstance(newItem);
      });
    },

    setInstance(instance) {
      self.instancesMap.put(instance);
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

    reinsertStep(currentIndex, targetIndex) {
      const current = self.selectedSteps[currentIndex];

      detach(current);
      self.selectedSteps.splice(targetIndex, 0, current); // this will reattach the step
    },

    removeStep(idOrStep) {
      const step = _.isString(idOrStep) ? self.getStep(idOrStep) : idOrStep;
      self.selectedSteps.remove(step);
    },

    addStep(step) {
      const { id, v, skippable, title, desc } = step;
      const workflowStep = WorkflowStep.create(
        {
          id: generateId('wf-step'),
          stepTemplateId: id,
          stepTemplateVer: v,
          title,
          desc,
          skippable,
        },
        getEnv(self),
      );

      workflowStep.makeNew();
      self.selectedSteps.push(workflowStep);

      return workflowStep;
    },
  }))

  .views(self => ({
    getStep(stepId) {
      return _.find(self.selectedSteps, step => step.id === stepId);
    },

    get instances() {
      const result = [];
      self.instancesMap.forEach(value => {
        // remember instancesMap is a Map not a simple object
        result.push(value);
      });

      return result;
    },

    getInstance(id) {
      return self.instancesMap.get(id);
    },

    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc, self.assets); // TODO declare assets
    },

    get system() {
      return self.createdBy.username === '_system_';
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

    // This is the workflow template version
    get template() {
      const templatesStore = getEnv(self).workflowTemplatesStore;
      const template = templatesStore.getTemplate(self.workflowTemplateId);
      if (!template) return undefined;
      return template.getVersion(self.workflowTemplateVer);
    },

    get canRearrangeSteps() {
      const template = self.template;
      if (!template) return false;
      return template.canWorkflowRearrangeSteps;
    },

    canOverrideProp(prop) {
      const template = self.template;
      if (!template) return false;
      return template.canWorkflowOverrideProp(prop);
    },

    get hasPendingInstances() {
      return _.some(self.instances, ['pending', true]);
    },
  }));

// ==================================================================
// Workflow
// ==================================================================
const Workflow = types
  .model('Workflow', {
    id: types.identifier,
    versions: types.optional(types.array(WorkflowVersion), []),
    assignments: types.optional(types.array(WorkflowAssignment), []),
  })
  .actions(self => ({
    setWorkflow(workflow) {
      // we try to preserve any existing version objects and update their content instead
      const mapOfExisting = _.keyBy(self.versions, version => version.v.toString());
      const processed = [];

      _.forEach(workflow.versions, workflowVersion => {
        const existing = mapOfExisting[workflowVersion.v];
        if (existing) {
          existing.setWorkflowVersion(workflowVersion);
          processed.push(existing);
        } else {
          processed.push(WorkflowVersion.create(workflowVersion));
        }
      });

      self.versions.replace(processed);
    },

    setAssignments(assignments) {
      // we try to preserve any existing assignment objects and update their content instead
      const mapOfExisting = _.keyBy(self.assignments, 'id');
      const processed = [];

      _.forEach(assignments, assignment => {
        const existing = mapOfExisting[assignment.id];
        if (existing) {
          existing.setWorkflowAssignment(assignment);
          processed.push(existing);
        } else {
          processed.push(WorkflowAssignment.create(assignment));
        }
      });

      self.assignments.replace(processed);
    },
  }))

  .views(self => ({
    get latest() {
      // we loop through all 'v' numbers and pick the workflow with the largest 'v' value
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

// Given an array of [ { id, v: 0, ... }, { id, v:1, ... } ]
// return an array of the grouping of the workflow versions based on their ids
// [ { id, versions: [ ... ] }, { id, versions: [ ... ] }, ...]
function toWorkflows(versions) {
  const map = {};
  _.forEach(versions, version => {
    const id = version.id;
    const entry = map[id] || { id, versions: [] };
    entry.versions.push(version);
    map[id] = entry;
  });

  return _.values(map);
}

export { Workflow, WorkflowVersion, WorkflowInstance, toWorkflows };
