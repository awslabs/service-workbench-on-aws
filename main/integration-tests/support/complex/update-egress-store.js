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

/**
 * A function that performs the complex task of updating isAbleToSubmitEgressRequest flag of an egress store
 *
 * @param {string} id The env id linked to egress store
 */
async function enableEgressRequest({ aws, id = '' }) {
  const db = await aws.services.dynamoDb();
  const egressStore = await db.tables.egressStore
    .getter()
    .key({ id })
    .get();

  if (_.isEmpty(egressStore)) {
    console.log(`EgressStore with id "${id}" does not exist, skipping the deletion of this egress store entry`);
    return;
  }

  egressStore.isAbleToSubmitEgressRequest = true;

  // Time to update the egress store from the egress store table
  await db.tables.egressStore
    .updater()
    .key({ id })
    .item(egressStore)
    .update();
}

module.exports = { enableEgressRequest };
