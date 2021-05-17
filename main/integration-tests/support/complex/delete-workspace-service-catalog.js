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

const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');
const _ = require('lodash');

/**
 * We need a delete method to remove service catalog workspaces
 * because the deletion done by the environment-sc service is a
 * soft delete. That is the record of the delete is not removed
 * from the database.
 */
async function deleteWorkspaceServiceCatalog({ aws, id = '' }) {
  const db = await aws.services.dynamoDb();
  let tryCount = 0;

  while (tryCount < 15) {
    tryCount += 1;

    const item = await db.tables.environmentsSc
      .getter()
      .key({ id })
      .projection(['status'])
      .get();

    if (_.isEmpty(item)) {
      return;
    }

    if (item.status === 'FAILED' || item.status === 'TERMINATED' || tryCount === 10) {
      await db.tables.environmentsSc
        .deleter()
        .key({ id })
        .delete();

      return;
    }

    await sleep(1000);
  }
}

module.exports = { deleteWorkspaceServiceCatalog };
