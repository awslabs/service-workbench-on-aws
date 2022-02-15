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

  let data = {};
  try {
    data = await sf.startExecution(params).promise();
  } catch (e) {
    throw this.boom.internalError(
      `Step Function could not start execution for State Machine ${stateMachineArn} with params ${JSON.stringify(
        params,
      )}. Error code: ${e.code}`,
      false,
    );
  }

  return {
    status: instance.status,
    instance,
    runSpec: instance.runSpec,
    executionArn: data.executionArn,
  };
}

module.exports = WorkflowTriggerService;
