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

const _ = require('lodash');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const WorkflowLoop = require('@aws-ee/workflow-engine/lib/workflow-loop');
const StepStateProvider = require('@aws-ee/workflow-engine/lib/step/step-state-provider');
const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const StepLoopProvider = require('@aws-ee/workflow-engine/lib/step/step-loop-provider');
const WorkflowInstance = require('@aws-ee/workflow-engine/lib/workflow-instance');
const WorkflowInput = require('@aws-ee/workflow-engine/lib/workflow-input');
const { catchIfErrorAsync } = require('@aws-ee/workflow-engine/lib/helpers/utils');

const WorkflowReporter = require('../workflow/helpers/workflow-reporter');

const settingKeys = {
  workflowsEnabled: 'workflowsEnabled',
};

// The event shape is:
// NOTE: AWS StepFunctions limit the event size to 32KB, this is way we shorten many of the property names here.
// {
//   "input": {
//     ... // the main input to the workflow
//   },
//   "meta": {
//     "wid": string,  // "wid" = workflow id
//     "wrv": string   // "wrv" = workflow revision (will then be parsed as int)
//     "sid": string,  // "sid" = workflow instance id
//                     // (if this is not present in here, nor in the loop, then a new workflow instance is created)
//     ...
//   },
//   "loop": {
//     "shouldWait": 0/1,  // this is here to communicate with the AWS Step Functions (state machine)
//     "shouldLoop": 0/1,  // this is here to communicate with the AWS Step Functions (state machine)
//     "shouldPass": 0/1,  // this is here to communicate with the AWS Step Functions (state machine)
//     "shouldFail": 0/1,  // this is here to communicate with the AWS Step Functions (state machine)
//     "wait": <int>,      // this is here to communicate with the AWS Step Functions (state machine)
//     "memento": {...},   // the workflowLoop memento
//     "slp": {...},       // "slp" = stepLoopProvider memento
//     "wp": {...},        // "wp" = workflowPayload memento
//     "ssp": { },         // step state provider mementos extremely limited in size
//                         // should not be used for large string values.  Remember the limit
//                         // for the whole event object is 32KB.
//     "error": { msg: string, stack: string (trimmed), ... } // this is for the case where the
//                                                            // workflowLoop catches the error
//   },
//
//   "error": {            // for the unhandled exceptions caught by AWS StepFunctions
//     "Error": "Error",
//     "Cause": {
//        "errorMessage": string, "errorType": "Error", "stackTrace": [ string ]
//     }
//   }
// }

function toNumber(input) {
  if (_.isUndefined(input)) return undefined;
  if (_.isNumber(input)) return input;

  return parseInt(input, 10);
}

async function handler({ input = {}, meta = {}, loop = {} } = {}, _context, registerServices) {
  // eslint-disable-line no-unused-vars
  const { memento = {}, wp = {}, ssp = {}, slp = {}, sid: sidFromLoop } = loop;

  // Register services
  const container = new ServicesContainer(['settings', 'log']);
  await registerServices(container);
  await container.initServices();

  // Check circular dependencies
  container.validate();

  const log = await container.find('log');
  const settings = await container.find('settings');
  const workflowsEnabled = settings.optionalBoolean(settingKeys.workflowsEnabled, true);

  if (!workflowsEnabled) {
    log.info('Skipping the processing of the workflows because the setting "workflowsEnabled" is false');
    return { shouldEnd: 1 };
  }

  const { wid, wrv, sid: sidFromMeta } = meta;
  let wrvParsed;
  let sid = sidFromMeta || sidFromLoop;
  const workflowInstanceService = await container.find('workflowInstanceService');
  let instance;

  // Wrap the raw input with WorkflowInput
  const wfInput = new WorkflowInput({ input });

  if (!sid) {
    wrvParsed = toNumber(wrv);
    if (_.isEmpty(wid) || _.isUndefined(wrvParsed)) {
      throw new Error('The "meta" part of the input must contain "wid" and "wrv"');
    }
    instance = await workflowInstanceService.createInstance(
      getSystemRequestContext(),
      {
        workflowId: wid,
        workflowVer: wrvParsed,
        status: 'in_progress',
      },
      wfInput,
    );
    sid = instance.id;
  } else {
    instance = await workflowInstanceService.mustFindInstance({ id: sid });
  }

  // TODO: Check if runSpec target is supported
  const workflowInstance = new WorkflowInstance({ workflowInstance: instance });

  // A convenient function to allow us to wrap a fn with catchIfErrorAsync
  const safeCall = fn => async (...params) => catchIfErrorAsync(async () => fn(...params));

  // Get the steps registry and register the steps and construct the classResolver
  const stepRegistry = await container.find('stepRegistryService');
  const classResolver = async ({ stepTemplateId, stepTemplateVer }) => {
    const entry = await stepRegistry.findStep({
      id: stepTemplateId,
      v: stepTemplateVer,
    });
    return entry ? entry.implClass : undefined;
  };

  // ----
  // Create and restore all the workflowLoop dependencies/helpers
  // ----

  // Create stepStateProvider
  const stepStateProvider = new StepStateProvider();
  stepStateProvider.setMemento(ssp);

  // Create workflowReporter
  const workflowReporter = new WorkflowReporter({
    workflowInstance,
    log,
    workflowInstanceService,
  });

  // Create and restore workflowPayload
  const workflowPayload = new WorkflowPayload({
    workflowInstance,
    meta,
    input: wfInput,
  });
  wp.m = !wp.m || _.isEmpty(wp.m) ? workflowPayload.meta : wp.m;
  workflowPayload.setMemento(wp);

  // Create stepClassProvider
  const stepClassProvider = {
    getClass: async ({ step, workflowStatus }) => {
      const Class = await classResolver(step);
      if (_.isNil(Class)) return undefined;
      const stepReporter = workflowReporter.getStepReporter({ step });
      const stepState = await stepStateProvider.getStepState({ step });
      const impl = new Class({
        input: wfInput,
        workflowInstance,
        container,
        workflowPayload,
        step,
        stepReporter,
        stepState,
        workflowStatus,
      });
      return impl;
    },
  };

  // Create and restore stepLoopProvider
  const stepLoopProvider = new StepLoopProvider({
    workflowInstance,
    stepClassProvider,
  });
  stepLoopProvider.setMemento(slp);

  // Register with the step loop provider event and the step loop events
  stepLoopProvider.on(
    'stepLoopCreated',
    safeCall(async stepLoop => {
      const step = stepLoop.step;
      const reporter = workflowReporter.getStepReporter({ step });
      stepLoop
        .on(
          'stepLoopSkipped',
          safeCall(async () => reporter.stepSkipped()),
        )
        .on(
          'stepLoopStarted',
          safeCall(async () => reporter.stepStarted()),
        )
        .on(
          'stepLoopMethodCall',
          safeCall(async name => reporter.print(`StepLoop - calling ${name}()`)),
        )
        .on(
          'stepLoopQueueAdd',
          safeCall(async msg => reporter.print(msg)),
        )
        .on(
          'stepLoopStepPausing',
          safeCall(async reasonForPause => reporter.stepPaused(reasonForPause)),
        )
        .on(
          'stepLoopStepResuming',
          safeCall(async reasonForResume => reporter.stepResumed(reasonForResume)),
        )
        .on(
          'stepLoopStepMaxPauseReached',
          safeCall(async () => reporter.stepMaxPauseReached()),
        )
        .on(
          'stepLoopRequestingGoTo',
          safeCall(async () => {
            // The step requested WF to execute from other step so the currently executing step is treated as passed
            // (or "done" - as it has done it's job of requesting to executing from other step)
            return reporter.stepPassed();
          }),
        )
        .on(
          'stepLoopPassed',
          safeCall(async () => reporter.stepPassed()),
        )
        .on(
          'stepLoopFailed',
          safeCall(async (...params) => reporter.stepFailed(...params)),
        )
        .on('beforeStepLoopTick', async () => {
          const stepState = await stepStateProvider.getStepState({ step });
          await stepState.load();
          await workflowPayload.load();
        })
        .on('afterStepLoopTick', async () => {
          const stepState = await stepStateProvider.getStepState({ step });
          await stepState.save();
          await workflowPayload.save();
        });
    }),
  );

  // Create and restore the workflowLoop
  const workflowLoop = new WorkflowLoop({ workflowInstance, stepLoopProvider });
  workflowLoop.setMemento(memento);

  // Register with the workflow loop events
  workflowLoop
    .on(
      'workflowStarted',
      safeCall(async () => workflowReporter.workflowStarted()),
    )
    .on(
      'workflowPaused',
      safeCall(async () => workflowReporter.workflowPaused()),
    )
    .on(
      'workflowResuming',
      safeCall(async () => workflowReporter.workflowResuming()),
    )
    .on(
      'workflowPassed',
      safeCall(async () => workflowReporter.workflowPassed()),
    )
    .on(
      'workflowFailed',
      safeCall(async (...params) => workflowReporter.workflowFailed(...params)),
    );

  // Run one iteration of the workflowLoop
  const decision = await workflowLoop.tick();

  // Deal with the output
  if (_.isEmpty(decision)) {
    throw new Error("The workflow loop tick() method didn't return a decision object");
  }
  const output = {
    shouldWait: 0,
    shouldLoop: 0,
    shouldPass: 0,
    shouldFail: 0,
    memento: workflowLoop.getMemento(),
    slp: stepLoopProvider.getMemento(),
    wp: workflowPayload.getMemento(),
    ssp: stepStateProvider.getMemento(),
  };

  if (!sidFromMeta) output.sid = sid;

  switch (decision.type) {
    case 'loop':
      output.shouldLoop = 1;
      break;
    case 'wait':
    case 'pause':
      output.shouldWait = 1;
      output.wait = decision.wait;
      break;
    case 'pass':
      output.shouldPass = 1;
      break;
    case 'fail':
      output.shouldFail = 1;
      output.error = _.omit(decision, ['type']);
      break;
    default:
      throw new Error(`The workflow loop tick() method returned unsupported decision type of "${decision.type}"`);
  }

  return output;
}

function handlerFactory({ registerServices }) {
  return async (event, context) => {
    return handler(event, context, registerServices);
  };
}

module.exports = handlerFactory;
