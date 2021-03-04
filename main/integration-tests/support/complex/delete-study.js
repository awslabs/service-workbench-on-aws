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
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

const { parseS3Arn } = require('../aws/utils/s3-arn');
const { run } = require('../utils/utils');

/**
 * A function that performs the complex task of deleting a study.
 *
 * @param {string} id The study id to be deleted
 */
async function deleteStudy({ aws, id = '' }) {
  // The clean up logic is as follows:
  // - As a measurement of caution, we only delete the study if its id contains the runId, this help us
  //   avoid deleting anything by accident.
  // - We get the study permission entry for the study from the study permissions table
  // - We find all the users who have any access to the study
  // - For each user, we find the user entry in the study permissions table
  //   - We remove any entry for the study for the user
  // - Delete the study entry from the study permissions table
  // - We delete the study from the studies table
  // - We delete the study s3 folder in the default data bucket (if the path contains runId)
  //   We need to revisit this logic once the BYOB branch is merged

  const runId = aws.settings.get('runId');

  if (!id.includes(`-${runId}-`)) {
    console.log(
      `Study id "${id}" does not contain the runId "${runId}", skipping the deletion of this study as a measurement of caution`,
    );
    return;
  }

  const db = await aws.services.dynamoDb();
  const study = await db.tables.studies
    .getter()
    .key({ id })
    .get();

  if (_.isEmpty(study)) {
    console.log(`Study with id "${id}" does not exist, skipping the deletion of this study`);
    return;
  }

  const permissions = await db.tables.studyPermissions
    .getter()
    .key({ id: `Study:${id}` })
    .get();

  if (!_.isEmpty(permissions)) {
    await deletePermissions({ db, study, permissions });
  }

  // Time to delete the study from the studies table
  await run(async () =>
    db.tables.studies
      .deleter()
      .key({ id })
      .delete(),
  );

  // Time to remove the study folder from the bucket. We only take the first resource listed in the study
  // resources property.
  // Note: we need to revisit this when the BYOB branch is merged
  const resourceArn = _.get(study, 'resources[0].arn');
  if (!_.isEmpty(resourceArn)) {
    const { bucket, prefix } = parseS3Arn(resourceArn);

    // Lets do a sanity check, if the prefix does not contain the runId, then we skip the deletion of the folder
    // Note: this logic needs revisiting when we merge the BYOB branch, because with BYOB, a study can be the
    // whole bucket
    if (!prefix.includes(runId)) {
      console.log(
        `Study id "${id}" has resource "${resourceArn}" that does not contain the runId "${runId}", skipping the deletion of the study folder as a measurement of caution`,
      );
    } else {
      const s3 = await aws.services.s3();
      await s3.deleteFolder(bucket, prefix);
    }
  }
}

// private function
async function deletePermissions({ db, study, permissions }) {
  // Find all users who have permissions to access this study
  const userIds = [
    ...(permissions.adminUsers || []),
    ...(permissions.readonlyUsers || []),
    ...(permissions.readwriteUsers || []),
    ...(permissions.writeonlyUsers || []),
  ];

  // For each user, we need to do the following
  // - Get the user permission entry from the study permissions table
  // - Remove the study id from any of the user permission entry
  // - Update the database
  const work = async userId => {
    const key = `User:${userId}`;
    const userPermissions = await db.tables.studyPermissions
      .getter()
      .key({ id: key })
      .get();

    const remove = array => _.remove(array, item => item === study.id);

    remove(userPermissions.adminAccess);
    remove(userPermissions.readonlyAccess);
    remove(userPermissions.readwriteAccess);
    remove(userPermissions.writeonlyAccess);

    await db.tables.studyPermissions
      .updater()
      .key({ id: key })
      .item({
        adminAccess: userPermissions.adminAccess,
        readonlyAccess: userPermissions.readonlyAccess,
        readwriteAccess: userPermissions.readwriteAccess,
        writeonlyAccess: userPermissions.writeonlyAccess,
      })
      .update();
  };

  await processInBatches(userIds, 10, async userId => run(async () => work(userId)));

  // Time to delete the study entry from the study permissions table
  await run(async () =>
    db.tables.studyPermissions
      .deleter()
      .key({ id: `Study:${study.id}` })
      .delete(),
  );
}

module.exports = { deleteStudy };
