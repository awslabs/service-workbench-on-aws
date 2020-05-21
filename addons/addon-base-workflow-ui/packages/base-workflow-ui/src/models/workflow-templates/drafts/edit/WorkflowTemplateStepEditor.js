import _ from 'lodash';
import { types, getParent, getEnv, clone, getSnapshot } from 'mobx-state-tree';

import getWorkflowStepDescForm from '../../../forms/WorkflowStepDescForm';
import getWorkflowStepPropsForm from '../../../forms/WorkflowStepPropsForm';
import getWorkflowStepConfigOverrideForm from '../../../forms/WorkflowStepConfigOverrideForm';
import getWorkflowStepPropsOverrideForm from '../../../forms/WorkflowStepPropsOverrideForm';
import ConfigurationEditor from '../../../configuration/ConfigurationEditor';

// ==================================================================
// WorkflowTemplateStepEditor
// ==================================================================
const WorkflowTemplateStepEditor = types
  .model('WorkflowTemplateStepEditor', {
    stepId: '', // The step Id for the workflow template step
    contentExpanded: false,
    configEdit: false, // If we are editing mode or not for the configuration section
    configOverrideEdit: false, // If we are editing mode or not for the configuration override section
    descEdit: false, // If we are editing mode or not for the description section
    propsEdit: false, // If we are editing mode or not for the props section
    propsOverrideEdit: false, // If we are editing mode or not for the props override section
  })

  .volatile(_self => ({
    configurationEditor: undefined,
    stepDescForm: undefined,
    stepConfigOverrideForm: undefined,
    stepPropsForm: undefined,
    stepPropsOverrideForm: undefined,
  }))

  .actions(self => {
    return {
      // I had issues using runInAction from mobx
      // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
      runInAction(fn) {
        return fn();
      },

      afterAttach() {
        if (self.configurationEditor !== undefined) return;
        const step = self.step;
        const inputManifest = _.get(step, 'stepTemplate.adminInputManifest');
        const defaults = getSnapshot(step.defaults);

        self.configurationEditor = ConfigurationEditor.create(
          {
            inputManifest: _.isUndefined(inputManifest) ? undefined : clone(inputManifest),
            configuration: defaults,
          },
          getEnv(self),
        );

        self.stepConfigOverrideForm = getWorkflowStepConfigOverrideForm(step);
        self.stepDescForm = getWorkflowStepDescForm(step);
        self.stepPropsForm = getWorkflowStepPropsForm(step);
        self.stepPropsOverrideForm = getWorkflowStepPropsOverrideForm(step);
      },

      setContentExpanded(flag) {
        self.contentExpanded = !!flag; // !! will simply turn any type to a boolean type
      },

      setConfigEdit(flag) {
        self.configEdit = flag;
      },

      setConfigOverrideEdit(flag) {
        self.configOverrideEdit = flag;
      },

      setDescEdit(flag) {
        self.descEdit = flag;
      },

      setPropsEdit(flag) {
        self.propsEdit = flag;
      },

      setPropsOverrideEdit(flag) {
        self.propsOverrideEdit = flag;
      },

      applyDefaults(configs = {}) {
        self.step.setDefaults(configs);
      },

      applyConfigOverrides(configOverrides = []) {
        self.step.setConfigOverrideOption({
          allowed: configOverrides,
        });
        self.stepConfigOverrideForm = getWorkflowStepConfigOverrideForm(self.step);
      },

      applyPropsOverrides(propsOverrides = []) {
        self.step.setPropsOverrideOption({
          allowed: propsOverrides,
        });
        self.stepPropsOverrideForm = getWorkflowStepPropsOverrideForm(self.step);
      },

      applyDescAndTitle(desc, title) {
        self.step.setDesc(desc);
        self.step.setTitle(title);
        self.stepDescForm = getWorkflowStepDescForm(self.step);
      },

      applySkippable(skippable) {
        self.step.setSkippable(skippable);
        self.stepPropsForm = getWorkflowStepPropsForm(self.step);
      },
    };
  })

  .views(self => ({
    get step() {
      const version = self.version;
      return version.getStep(self.stepId);
    },

    get version() {
      const parentEditor = getParent(self, 2);
      return parentEditor.version;
    },

    get configOverrideForm() {
      return self.stepConfigOverrideForm;
    },

    get descForm() {
      return self.stepDescForm;
    },

    get propsForm() {
      return self.stepPropsForm;
    },

    get propsOverrideForm() {
      return self.stepPropsOverrideForm;
    },

    get editing() {
      return self.configEdit || self.descEdit || self.propsEdit || self.configOverrideEdit || self.propsOverrideEdit;
    },
  }));

export default WorkflowTemplateStepEditor;
