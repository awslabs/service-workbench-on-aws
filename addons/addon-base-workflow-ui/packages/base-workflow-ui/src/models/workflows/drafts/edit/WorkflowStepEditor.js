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
import { types, getParent, getEnv, getSnapshot } from 'mobx-state-tree';
import { visit } from '@aws-ee/base-ui/dist/models/forms/InputManifest';

import getWorkflowStepDescForm from '../../../forms/WorkflowStepDescForm';
import getWorkflowStepPropsForm from '../../../forms/WorkflowStepPropsForm';
import ConfigurationEditor from '../../../configuration/ConfigurationEditor';

// ==================================================================
// WorkflowStepEditor
// ==================================================================
const WorkflowStepEditor = types
  .model('WorkflowStepEditor', {
    stepId: '', // The step id for the workflow step
    contentExpanded: false,
    configEdit: false, // If we are editing mode or not for the configuration section
    descEdit: false, // If we are editing mode or not for the description section
    propsEdit: false, // If we are editing mode or not for the props section
  })

  .volatile((_self) => ({
    configurationEditor: undefined,
    stepDescForm: undefined,
    stepPropsForm: undefined,
  }))

  .actions((self) => {
    return {
      // I had issues using runInAction from mobx
      // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
      runInAction(fn) {
        return fn();
      },

      afterAttach() {
        if (self.configurationEditor !== undefined) return;
        const step = self.step;
        const inputManifest = _.get(step, 'stepTemplate.inputManifest');
        const configs = getSnapshot(step.configs);
        const allowed = step.configOverrideOption.allowed;
        const defaults = self.defaults;

        self.configurationEditor = ConfigurationEditor.create(
          {
            inputManifest: _.isUndefined(inputManifest)
              ? undefined
              : prepareInputManifest(inputManifest, { allowed, defaults }),
            configuration: configs,
          },
          getEnv(self),
        );

        self.stepDescForm = getWorkflowStepDescForm(step, { isTemplate: false });
        self.stepPropsForm = getWorkflowStepPropsForm(step, { isTemplate: false });
      },

      setContentExpanded(flag) {
        self.contentExpanded = !!flag; // !! will simply turn any type to a boolean type
      },

      setConfigEdit(flag) {
        self.configEdit = flag;
      },

      setDescEdit(flag) {
        self.descEdit = flag;
      },

      setPropsEdit(flag) {
        self.propsEdit = flag;
      },

      applyConfigs(configs = {}) {
        self.step.setConfigs(configs);
      },

      applyDescAndTitle(desc, title) {
        self.step.setDesc(desc);
        self.step.setTitle(title);
        self.stepDescForm = getWorkflowStepDescForm(self.step, { isTemplate: false });
      },

      applySkippable(skippable) {
        self.step.setSkippable(skippable);
        self.stepPropsForm = getWorkflowStepPropsForm(self.step, { isTemplate: false });
      },
    };
  })

  .views((self) => ({
    get step() {
      const version = self.version;
      return version.getStep(self.stepId);
    },

    // WorkflowVersion
    get version() {
      const parentEditor = getParent(self, 2);
      return parentEditor.version;
    },

    // The workflow template step defaults (if this workflow step has an associated workflow template step with it)
    get defaults() {
      const workflowVersion = self.version;
      if (!workflowVersion) return undefined;
      const workflowTemplateVersion = workflowVersion.template;
      if (!workflowTemplateVersion) return undefined;
      const workflowTemplateStep = workflowTemplateVersion.getStep(self.stepId);
      if (!workflowTemplateStep) return undefined;

      return workflowTemplateStep.defaults;
    },

    get descForm() {
      return self.stepDescForm;
    },

    get propsForm() {
      return self.stepPropsForm;
    },

    get editing() {
      return self.configEdit || self.descEdit || self.propsEdit;
    },
  }));

// Returns a copy of the input manifest (but as a json object), the copy has its entries updated as follows:
// - If the entry name is not allowed to be overridden, then disabled is turned on with a warn message in the extra section
// - If there is a default value for the given key, then it is set on the entry
function prepareInputManifest(inputManifest, { allowed = [], defaults: rawDefaults }) {
  if (_.isEmpty(inputManifest)) return inputManifest;
  const names = inputManifest.names;
  const copy = _.cloneDeep(getSnapshot(inputManifest));
  const defaults = rawDefaults ? getSnapshot(rawDefaults) : {};

  const visitFn = (item) => {
    if (!item.name) return undefined;
    const name = item.name;
    if (!names.includes(name)) return undefined;

    if (!allowed.includes(name)) {
      item.disabled = true;
      _.set(item, 'extra.warn', 'The workflow template used by this workflow does not allow you to modify this field');
    }

    if (_.has(defaults, name)) {
      item.default = defaults[name];
    }
    return item;
  };

  _.forEach(copy.sections, (section) => {
    visit(section.children, visitFn);
  });

  return copy;
}

export default WorkflowStepEditor;
