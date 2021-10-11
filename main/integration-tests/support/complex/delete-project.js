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
 * A function that performs the complex task of deleting a project.
 *
 * @param {string} id The project id to be deleted
 */
async function deleteProject({ aws, id = '' }) {
  // The clean up logic is as follows:
  // - As a measurement of caution, we only delete the project if its id contains the runId, this help us
  //   avoid deleting anything by accident.
  // - We delete the project entry from the projects table

  const runId = aws.settings.get('runId');
  const db = await aws.services.dynamoDb();
  const project = await db.tables.projects
    .getter()
    .key({ id })
    .get();

  if (_.isEmpty(project)) {
    console.log(`Project with id "${id}" does not exist, skipping the deletion of this project`);
    return;
  }

  const projectName = project.id || '';

  if (!projectName.includes(`-${runId}-`)) {
    console.log(
      `Project "${projectName}" does not contain the runId "${runId}", skipping the deletion of this project as a measurement of caution`,
    );

    return;
  }

  // Delete the proj row from the Projects table
  await run(async () =>
    db.tables.projects
      .deleter()
      .key({ id })
      .delete(),
  );
}

module.exports = { deleteProject };
