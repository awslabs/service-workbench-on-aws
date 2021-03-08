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
 * A function that performs the complex task of un-registering a data source account.
 */
async function unregisterAccount({ aws, id = '' }) {
  // The clean up logic:
  // - Get the account row from the database, if the name of the account does not contain the runID, then
  //   skip the deletion of the account to avoid deleting the entry by mistake.
  // - Future: we check if there is a cfn template already created for the account and 'if' so, then we
  //   need to delete the cfn stack.

  const runId = aws.settings.get('runId');
  const db = await aws.services.dynamoDb();

  const accountEntity = await db.tables.dsAccounts
    .getter()
    .key({ pk: `ACT#${id}`, sk: `ACT#${id}` })
    .get();

  if (_.isEmpty(accountEntity)) {
    console.log(`Account with id "${id}" does not exist, skipping the un-registering of the account`);
    return;
  }

  if (!accountEntity.name.includes(`-${runId}-`)) {
    console.log(
      `Account id "${id}" does not contain the runId "${runId}", skipping the un-registering of the account as a measurement of caution`,
    );
    return;
  }

  // We delete any cfn templates that we generated and uploaded to S3 (if any)
  const cfnBucket = aws.settings.get('environmentsBootstrapBucketName');
  const s3 = await aws.services.s3();
  await run(async () => s3.deleteFolder(cfnBucket, `data-sources/acct-${id}/`));

  // We delete the entry
  await run(async () =>
    db.tables.dsAccounts
      .deleter()
      .key({ pk: `ACT#${id}`, sk: `ACT#${id}` })
      .delete(),
  );
}

module.exports = { unregisterAccount };
