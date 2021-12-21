/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
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

const { run } = require('../utils/utils');

/**
 * A function that performs the complex task of deleting a workflow instance.
 */
async function deleteWorkflowInstance({ aws, instanceId, workflowId, version, executionArn }) {
  // The clean up logic is as follows:
  // - As a measurement of caution, we only delete the instance if its workflow id contains the runId, this help us
  //   avoid deleting anything by accident.
  // - We get the instance information from the database
  // - If executionArn is provided we use it to stop the execution (if it was still running)
  // - We then remove the instance entry from the database

  const runId = aws.settings.get('runId');

  if (!workflowId.includes(`-${runId}-`)) {
    console.log(
      `Workflow id "${workflowId}" does not contain the runId "${runId}", skipping the deletion of this workflow version as a measurement of caution`,
    );
    return;
  }

  const db = await aws.services.dynamoDb();
  const instance = await db.tables.workflowInstances
    .getter()
    .key({ id: instanceId })
    .get();

  if (_.isEmpty(instance)) {
    console.log(
      `Workflow with id "${workflowId}" v"${version}" instance "${instanceId}" does not exist, skipping the deletion of this workflow instance`,
    );
    return;
  }

  if (!_.isEmpty(executionArn)) {
    const stepFunctions = await aws.services.stepFunctions();

    try {
      await stepFunctions.stopExecution(executionArn);
    } catch (error) {
      // We ignore the error, because the execution might have already been stopped
    }
  }

  await run(async () =>
    db.tables.workflowInstances
      .deleter()
      .key({ id: instanceId })
      .delete(),
  );
}

module.exports = { deleteWorkflowInstance };
