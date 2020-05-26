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

/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { ensureAdmin } = require('@aws-ee/base-services/lib/authorization/assertions');
const { toVersionString, parseVersionString, runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const PropsOverrideOption = require('./helpers/props-override-option');
const ConfigOverrideOption = require('./helpers/config-override-option');
const inputSchema = require('../schema/workflow');
const {
  workflowPropsSupportedOverrideKeys,
  workflowPropsSupportedOverrideKeysTransformer,
  stepPropsSupportedOverrideKeys,
  stepPropsSupportedOverrideKeysTransformer,
} = require('./helpers/supported-override');

const settingKeys = {
  tableName: 'dbTableWorkflows',
};

class WorkflowService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'stepTemplateService',
      'workflowTemplateService',
      'dbService',
      'auditWriterService',
    ]);
  }

  async init() {
    await super.init();
    this.tableName = this.settings.get(settingKeys.tableName);
    this.internals = {
      findSteps: findSteps.bind(this),
      applyOverrideConstraints: applyOverrideConstraints.bind(this),
    };
  }

  async createVersion(requestContext, manifest = {}, { isLatest = true, tableName } = {}) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);

    await ensureAdmin(requestContext);
    // Validate input
    await jsonSchemaValidationService.ensureValid(manifest, inputSchema);

    const [dbService] = await this.service(['dbService']);
    const table = tableName || this.tableName;
    const { id, v } = manifest;
    const logPrefix = `The workflow "${id}" with ver "${v}" and rev "0"`;
    const preparedWorkflow = await this.prepareWorkflow(_.cloneDeep(manifest));

    const dbObject = toDbObject(preparedWorkflow);

    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }

    // TODO: we need to wrap the creation of the version and the update of the latest record in a transaction
    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_not_exists(ver)') // yes we need this
          .key({ id, ver: toVersionString(v) })
          .item({ ...dbObject, rev: 0, createdBy: by, updatedBy: by })
          .update();
      },
      async () => {
        throw this.boom.badRequest(`${logPrefix} already exist`, true);
      },
    );

    if (isLatest) {
      await runAndCatch(
        async () => {
          return dbService.helper
            .updater()
            .table(table)
            .updatedAt(result.updatedAt)
            .disableCreatedAt()
            .key({ id, ver: toVersionString(0) })
            .condition('(attribute_exists(id) and #latest <= :latest) or attribute_not_exists(id)')
            .item({ ...result, latest: v })
            .names({ '#latest': 'latest' })
            .values({ ':latest': v })
            .update();
        },
        async () => {
          // we ignore the ConditionalCheckFailedException exception because it simply means that the created version is not the
          // latest version anymore and there is no need to inform the caller of this fact
        },
      );
    }
    const dataObjectResult = toDataObject(result);

    // Write audit event
    await this.audit(requestContext, { action: 'create-workflow-version', body: dataObjectResult });

    return dataObjectResult;
  }

  // Use this method if you have a workflow object and you want to enrich it with the necessary default values
  // (such as step title, desc) also this method enforces any constraints specified in the workflow templates, such as
  // if the workflow can override the title of the workflow, or the configuration value of a step.  This method mutates the provided
  // workflow object.
  async prepareWorkflow(workflow) {
    const { workflowTemplateId, workflowTemplateVer } = workflow;
    const [workflowTemplateService] = await this.service(['workflowTemplateService']);

    const workflowTemplate = await workflowTemplateService.mustFindVersion({
      id: workflowTemplateId,
      v: workflowTemplateVer,
    });
    const stepsOrderChanged = didStepsOrderChange(workflow, workflowTemplate);
    const stepsMap = await this.internals.findSteps(workflow, workflowTemplate);

    workflow.stepsOrderChanged = stepsOrderChanged;

    workflow = applyDefaults(workflow, workflowTemplate, stepsMap);

    this.internals.applyOverrideConstraints(workflow, workflowTemplate, stepsMap, stepsOrderChanged);

    return workflow;
  }

  // NOTE: if a workflow is to be updated, a draft should be created and published, don't use this method to accomplish this.
  // This method is here to help with scenarios where (internally) we want to update an existing version without creating a new one.
  async updateVersion(requestContext, manifest = {}, { isLatest = true, tableName } = {}) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);

    // we need to remove 'rev' here because the schema does not allow it, we should have a schema
    // that allows 'rev' but for now, we don't do that.
    await jsonSchemaValidationService.ensureValid(_.omit(manifest, ['rev']), inputSchema);
    // now we need to check that rev is supplied
    if (_.isNil(manifest.rev))
      throw this.boom.badRequest('The supplied workflow does not have the "rev" property', true);

    const [dbService] = await this.service(['dbService']);
    const table = tableName || this.tableName;
    const { id, v, rev } = manifest;
    const logPrefix = `The workflow "${id}" with ver "${v}" and rev "${rev}"`;

    // TODO: Validate configuration

    const preparedWorkflow = await this.prepareWorkflow(_.cloneDeep(manifest));
    const dbObject = toDbObject(preparedWorkflow);

    // For now, we assume that updatedBy' is always a user and not a group
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }

    // TODO: we need to wrap the creation of the version and the update of the latest record in a transaction
    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_exists(ver)') // yes we need this
          .key({ id, ver: toVersionString(v) })
          .rev(rev)
          .item({ ...dbObject, updatedBy: by })
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The "v" entry does not exist
        // 2 - The "rev" does not match
        const existing = await this.findVersion({ id, v, fields: ['id', 'v', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `${logPrefix} information changed by "${existing.updatedBy}" just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.badRequest(`${logPrefix} does not exist`, true);
      },
    );

    if (isLatest) {
      await runAndCatch(
        async () => {
          return dbService.helper
            .updater()
            .table(table)
            .updatedAt(result.updatedAt)
            .key({ id, ver: toVersionString(0) })
            .condition('#latest = :latest')
            .item(result)
            .names({ '#latest': 'latest' })
            .values({ ':latest': v })
            .update();
        },
        async () => {
          // we ignore the ConditionalCheckFailedException exception because it simply means that the updated version is not the
          // latest version anymore and there is no need to inform the caller of this fact
        },
      );
    }
    return toDataObject(result);
  }

  // List all versions for all workflows or for a specific workflow if the workflow id was provided
  async listVersions({ id, fields = [] } = {}) {
    const dbService = await this.service('dbService');
    const table = this.tableName;

    if (_.isNil(id)) {
      // The scanner route
      const result = await dbService.helper
        .scanner()
        .table(table)
        .filter('attribute_not_exists(latest)')
        .limit(2000)
        .projection(fields)
        .scan();
      return _.map(result, item => toDataObject(item));
    }

    const result = await dbService.helper
      .query()
      .table(table)
      .key('id', id)
      .forward(false)
      .filter('attribute_not_exists(latest)')
      .limit(2000)
      .projection(fields)
      .query();
    return _.map(result, item => toDataObject(item));
  }

  // List latest versions of all the workflows
  async list({ fields = [] } = {}) {
    const dbService = await this.service('dbService');
    const table = this.tableName;

    // The scanner route
    const result = await dbService.helper
      .scanner()
      .table(table)
      .filter('attribute_exists(latest)')
      .limit(2000)
      .projection(fields)
      .scan();
    return _.map(result, item => toDataObject(item));
  }

  async findVersion({ id, v = 0, fields = [] }, { tableName } = {}) {
    const dbService = await this.service('dbService');
    // This function can accept a different tableName to use for the lookup, this is useful in places
    // such as post deployment
    const table = tableName || this.tableName;

    const result = await dbService.helper
      .getter()
      .table(table)
      .key({ id, ver: toVersionString(v) })
      .projection(fields)
      .get();

    return toDataObject(result);
  }

  async mustFindVersion({ id, v = 0, fields }) {
    const workflow = await this.findVersion({ id, v, fields });
    if (!workflow) throw this.boom.notFound(`The workflow "${id}" ver "${v}" is not found`, true);
    return workflow;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

// Lookup all the step templates that are referenced in the manifest, they might be
// in the workflowTemplate or they might not be (if the workflow decided to change the order and include
// new steps or remove steps).
// The output shape is a map:
// { '<step-id>': { templateSelectedStep, selectedStep, stepTemplate }, ... }
// You get templateSelectedStep in the map if the step id belongs to a selected step from the workflow template,
// otherwise you get just the selectedStep (when the workflow uses a step that is not part of the workflow template)
// and the stepTemplate.
async function findSteps(manifest, workflowTemplate) {
  const [stepTemplateService] = await this.service(['stepTemplateService']);
  const templateMap = {};
  const map = {};

  _.forEach(workflowTemplate.selectedSteps, step => {
    templateMap[step.id] = { templateSelectedStep: step, stepTemplate: step.stepTemplate };
  });

  /* eslint-disable no-restricted-syntax */
  for (const step of manifest.selectedSteps) {
    const { stepTemplateId, stepTemplateVer } = step;
    const id = step.id;
    const entry = templateMap[id];

    if (entry) {
      map[id] = { selectedStep: step, ...entry };
    } else {
      const stepTemplate = await stepTemplateService.mustFindVersion({ id: stepTemplateId, v: stepTemplateVer });
      map[id] = { selectedStep: step, stepTemplate };
    }
  }
  /* eslint-enable no-restricted-syntax */

  return map;
}

function applyDefaults(manifest, workflowTemplate, stepsMap) {
  const ifNil = (value, defaultValue) => {
    return _.isNil(value) ? defaultValue : value;
  };

  // First, we apply title, desc, builtin, hidden, runSpec from the workflow template
  const result = {
    ...createObj(workflowTemplate, ['title', 'desc', 'instanceTtl', 'builtin', 'hidden', 'runSpec']),
    ...manifest,
  };

  // If instanceTtl is not provided then use the workflowTemplate, remember that -1 means indefinite
  result.instanceTtl = ifNil(manifest.instanceTtl, workflowTemplate.instanceTtl);

  result.selectedSteps = [];
  _.forEach(manifest.selectedSteps, (step, index) => {
    const mapEntry = stepsMap[step.id];
    const { templateSelectedStep = {}, selectedStep, stepTemplate } = mapEntry;

    // We start with title, desc, skippable and src
    const stepResult = {
      ...createObj(stepTemplate, ['title', 'desc', 'skippable', 'src']),
      ...createObj(templateSelectedStep, ['title', 'desc', 'skippable']), // if templateSelectedStep exists
      ...createObj(selectedStep, ['title', 'desc', 'skippable']),
      ..._.omit(selectedStep, ['title', 'desc', 'skippable', 'src']),
    };

    // We now deal with the config and the defaults
    const configs = { ...(templateSelectedStep.defaults || {}), ...selectedStep.configs };
    stepResult.configs = removeEmptyStrings(configs);

    // We attach the workflow template step override options to the workflow step for easy access
    if (_.isEmpty(templateSelectedStep)) {
      // Since we don't have a template selected step, we allow all possible overrides
      stepResult.propsOverrideOption = { allowed: ['title', 'desc', 'skippable'] };
      stepResult.configOverrideOption = {
        allowed: _.flatten(
          _.map(_.get(stepTemplate, 'inputManifest.sections', []), section => findConfigNames(section)),
        ),
      };
    } else {
      stepResult.configOverrideOption = templateSelectedStep.configOverrideOption;
      stepResult.propsOverrideOption = templateSelectedStep.propsOverrideOption;
    }

    // Assign the result back to the selected step
    result.selectedSteps[index] = stepResult;
  });

  return result;
}

function applyOverrideConstraints(manifest, workflowTemplate, stepsMap, stepsOrderChanged) {
  // First we check the workflowTemplate props override constraints, this includes:
  // title, desc, instanceTtl, runSpec
  const workflowPropsOverrideOption = new PropsOverrideOption(
    workflowTemplate.propsOverrideOption,
    workflowPropsSupportedOverrideKeys,
    workflowPropsSupportedOverrideKeysTransformer,
  );
  const workflowPropsViolation = workflowPropsOverrideOption.violatedProps(manifest, workflowTemplate);
  const errors = [];

  if (workflowPropsViolation.length > 0) {
    errors.push(`The workflow can not override the following properties [${workflowPropsViolation}]`);
  }

  // Now, we loop through each step and collect all the violations
  _.forEach(manifest.selectedSteps, step => {
    const { stepTemplateId, stepTemplateVer } = step;
    const mapEntry = stepsMap[step.id];
    const { templateSelectedStep = {}, stepTemplate } = mapEntry;
    if (_.isEmpty(templateSelectedStep)) return;

    const srcStep = {
      ...createObj(stepTemplate, ['title', 'desc', 'skippable', 'src']),
      ...createObj(templateSelectedStep, ['title', 'desc', 'skippable']),
    };

    let overrideOption = new PropsOverrideOption(
      templateSelectedStep.propsOverrideOption,
      stepPropsSupportedOverrideKeys,
      stepPropsSupportedOverrideKeysTransformer,
    );
    const propsViolation = overrideOption.violatedProps(step, srcStep);
    if (propsViolation.length > 0) {
      errors.push(
        `The step "${stepTemplateId}" v${stepTemplateVer} can not override the following properties [${propsViolation}]`,
      );
    }

    overrideOption = new ConfigOverrideOption(templateSelectedStep.configOverrideOption);
    const configsViolation = overrideOption.violatedConfigs(step.configs, templateSelectedStep.defaults);
    if (configsViolation.length > 0) {
      errors.push(
        `The step "${stepTemplateId}" v${stepTemplateVer} can not override the following configuration keys [${configsViolation}]`,
      );
    }
  });

  if (stepsOrderChanged && !workflowPropsOverrideOption.allowStepsOrderChange) {
    errors.push('The workflow can not change the order of the steps');
  }

  if (errors.length > 0) {
    throw this.boom.badRequest(`${errors.join('. ')}`, true);
  }
}

// Did the order of the steps changed, were there additional steps or steps that are removed, or steps that are reordered
function didStepsOrderChange(manifest, workflowTemplate = {}) {
  const steps = manifest.selectedSteps || [];
  const stepsSize = steps.length;
  const templateSteps = workflowTemplate.selectedSteps || [];
  const templateStepsSize = templateSteps.length;

  if (stepsSize !== templateStepsSize) return true;
  let changed = false;

  _.forEach(steps, (step, index) => {
    const templateStep = templateSteps[index];
    if (templateStep.stepTemplateId !== step.stepTemplateId || templateStep.stepTemplateVer !== step.stepTemplateVer) {
      changed = true;
      return false;
    }
    if (templateStep.id !== step.id) {
      changed = true;
      return false;
    }
    return undefined;
  });

  return changed;
}

// Creates an object using the provided obj but only if the provided props are not nil
function createObj(obj, props) {
  const result = {};
  _.forEach(props, prop => {
    if (!_.isNil(obj[prop])) result[prop] = obj[prop];
  });

  return result;
}

// Do some properties renaming to prepare the object to be saved in the database
function toDbObject(dataObject) {
  const result = { ...dataObject };

  delete result.ver;
  delete result.createdAt;
  delete result.createdBy;
  delete result.updatedAt;
  delete result.updatedBy;
  delete result.rev;

  return result;
}

// Do some properties renaming to restore the object that was saved in the database
function toDataObject(dbObject) {
  if (_.isNil(dbObject)) return dbObject;
  if (!_.isObject(dbObject)) return dbObject;

  const result = { ...dbObject };
  result.v = result.latest ? result.latest : parseVersionString(dbObject.ver);

  delete result.ver;
  delete result.latest;

  return result;
}

function findConfigNames(entry) {
  if (entry === undefined) return [];

  const out = [];
  const { name, children = [] } = entry;
  if (!entry.nonInteractive) {
    out.push(name);
    children.forEach(child => {
      out.push(...findConfigNames(child));
    });
  }

  return out;
}

// Go through the object own props and if they are empty strings, remove the props
function removeEmptyStrings(srcObject) {
  const result = {};

  Object.keys(srcObject).forEach(key => {
    const value = srcObject[key];
    if (_.isString(value) && _.isEmpty(value)) return;
    result[key] = value;
  });

  return result;
}

module.exports = WorkflowService;
