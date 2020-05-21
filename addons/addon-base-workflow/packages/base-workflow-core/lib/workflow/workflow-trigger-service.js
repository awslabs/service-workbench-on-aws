/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const metaSchema = require('../schema/trigger-workflow');

const settingKeys = {
  stateMachineArn: 'smWorkflow',
};

class WorkflowTriggerService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'workflowService', 'workflowInstanceService', 'aws']);
  }

  async init() {
    await super.init();
    this.internals = {
      triggerStepFunctions: triggerStepFunctions.bind(this),
    };
  }

  async triggerWorkflow(requestContext, meta, input) {
    const [jsonSchemaValidationService, workflowService, workflowInstanceService] = await this.service([
      'jsonSchemaValidationService',
      'workflowService',
      'workflowInstanceService',
    ]);

    // Get the latest version, if not provided
    if (meta && !meta.workflowVer) {
      const wfLatestVersion = workflowService.findVersion({ id: meta.workflowId });
      meta.workflowVer = wfLatestVersion.ver;
    }

    // Validate input
    await jsonSchemaValidationService.ensureValid(meta, metaSchema);

    const instance = await workflowInstanceService.createInstance(requestContext, meta, input);
    const target = instance.runSpec.target;

    let result;
    switch (target) {
      case 'stepFunctions':
        result = this.internals.triggerStepFunctions({ instance, meta, input });
        break;
      default:
        throw this.boom.badRequest(`The run target "${target}" is not supported yet`);
    }

    return result;
  }
}

async function triggerStepFunctions({ instance, meta, input }) {
  const aws = await this.service('aws');
  const { wfId: workflowId, wfVer: workflowVer, id: instanceId } = instance;
  const stateMachineArn = meta.smWorkflow || this.settings.get(settingKeys.stateMachineArn);
  const name = `${workflowId}_${workflowVer}_${instance.id}`;

  const sf = new aws.sdk.StepFunctions();
  const params = {
    stateMachineArn,
    input: JSON.stringify({
      meta: _.assign({}, meta, { wid: workflowId, sid: instanceId, wrv: workflowVer, smWorkflow: stateMachineArn }),
      input,
    }),
    name,
  };

  const data = await sf.startExecution(params).promise();

  return {
    status: instance.status,
    instance,
    runSpec: instance.runSpec,
    executionArn: data.executionArn,
  };
}

module.exports = WorkflowTriggerService;
