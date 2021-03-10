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
const { deleteWorkflowInstance } = require('./delete-workflow-instance');

/**
 * A function that performs the complex task of deleting a workflow version.
 *
 * @param {string} id The workflow id to be deleted
 * @param {number} v The version of the workflow to be deleted
 */
async function deleteWorkflowVersion({ aws, id, version = 1 }) {
  // The clean up logic is as follows:
  // - As a measurement of caution, we only delete the version if its id contains the runId, this help us
  //   avoid deleting anything by accident.
  // - We first find all the versions of the given workflow id
  // - If we find a version match, then we do the following:
  //   - We delete the entry for that version from the database
  //   - We check if the deleted entry was the only entry (aside from v=0000_ entry)
  //   - If so, then we delete the v=0000_ entry
  //   - Otherwise, we see if the v=0000_ latest was pointing to the deleted entry
  //   - If so, then we update the latest point to point to the version before the one that got deleted

  const runId = aws.settings.get('runId');

  if (!id.includes(`-${runId}-`)) {
    console.log(
      `Workflow id "${id}" does not contain the runId "${runId}", skipping the deletion of this workflow version as a measurement of caution`,
    );
    return;
  }

  const db = await aws.services.dynamoDb();

  // This returns a list of all the versions for the given workflow id, sorted by the 'v' field
  // in ascending order.
  const versions = await db.tables.workflows
    .query()
    .key('id', id)
    .limit(2000)
    .query();

  // First, lets remove the v000_ version from the 'versions' array and hold onto it
  const latest = _.first(_.remove(versions, item => item.ver === 'v0000_'));

  // We remove the desired version from the 'versions' array and hold onto it
  const workflow = _.first(_.remove(versions, item => item.v === version));
  if (_.isEmpty(workflow)) {
    console.log(`Workflow with id "${id}" v"${version}" does not exist, skipping the deletion of this workflow`);
    return;
  }

  // We need to delete all the workflow instances associated with this specific workflow id and version
  await deleteInstances({ aws, db, workflow });

  // We delete the specific version from the database
  await deleteVersion({ db, workflow });

  // If there are no more versions left then delete the latest pointer entry if it exists
  if (_.isEmpty(versions)) {
    if (!_.isEmpty(latest)) {
      await deleteVersion({ db, workflow: latest });
    }

    // We are done, lets exit
    return;
  }

  // Otherwise, make the latest pointer point to the last element in the versions
  const last = _.last(versions);
  await run(async () =>
    db.tables.workflows
      .updater()
      .updatedAt(last.updatedAt)
      .disableCreatedAt()
      .key({ id, ver: 'v0000_' })
      .item({ ...last, latest: last.v })
      .update(),
  );
}

async function deleteVersion({ db, workflow }) {
  return run(async () =>
    db.tables.workflows
      .deleter()
      .key({ id: workflow.id, ver: workflow.ver })
      .delete(),
  );
}

async function deleteInstances({ aws, db, workflow }) {
  const instances = await db.tables.workflowInstances
    .query()
    .index('WorkflowIndex')
    .key('wf', workflow.id)
    .limit(2000)
    .query();

  for (const row of instances) {
    const instanceId = row.id;
    const workflowId = workflow.id;
    const version = workflow.v;
    await deleteWorkflowInstance({ aws, instanceId, workflowId, version });
  }
}

module.exports = { deleteWorkflowVersion };
