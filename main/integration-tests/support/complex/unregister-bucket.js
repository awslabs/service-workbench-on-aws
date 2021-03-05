/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
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
 * A function that performs the complex task of un-registering a data source bucket.
 */
async function unregisterBucket({ aws, name = '', accountId }) {
  // The clean up logic:
  // - Get the bucket row from the database, if the name of the bucket does not contain the runID, then
  //   skip the deletion of the bucket row to avoid deleting the entry by mistake.
  // - We look for all the role allocation entries in RoleAllocations table that belong to this bucket
  //   and delete these entries

  const runId = aws.settings.get('runId');
  const db = await aws.services.dynamoDb();
  const pk = `ACT#${accountId}`;
  const sk = `BUK#${name}`;

  const bucketEntity = await db.tables.dsAccounts
    .getter()
    .key({ sk, pk })
    .get();

  if (_.isEmpty(bucketEntity)) {
    console.log(`Bucket "${name}" does not exist, skipping the un-registering of the bucket`);
    return;
  }

  if (!bucketEntity.sk.includes(`-${runId}-`)) {
    console.log(
      `Bucket "${name}" does not contain the runId "${runId}", skipping the un-registering of the bucket as a measurement of caution`,
    );
    return;
  }

  // We need to get all the role allocation entries (if any)
  const roleSkPrefix = `APP#${name}`;
  const allocations = await run(async () =>
    db.tables.roleAllocations
      .query()
      .key('pk', pk)
      .sortKey('sk')
      .begins(roleSkPrefix)
      .limit(1000)
      .query(),
  );

  for (const allocation of allocations) {
    await run(async () =>
      db.tables.roleAllocations
        .deleter()
        .key({ pk: allocation.pk, sk: allocation.sk })
        .delete(),
    );
  }

  // We delete the entry
  await run(async () =>
    db.tables.dsAccounts
      .deleter()
      .key({ pk, sk })
      .delete(),
  );
}

module.exports = { unregisterBucket };
