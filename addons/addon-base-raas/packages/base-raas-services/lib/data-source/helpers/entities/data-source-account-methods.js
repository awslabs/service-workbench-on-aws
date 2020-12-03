/* eslint-disable no-await-in-loop */
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

/**
 * This file contains a collection of functions that are used with the
 * dsAccountEntity. Think of these functions as derived attributes
 * or functions that are part of the dsAccountEntity.
 */

const _ = require('lodash');

const { accountIdCompositeKey } = require('../composite-keys');

/**
 * Returns the data source account entity given its db entity version.
 *
 * @param dbEntity The db entity (a.k.a db record) to use to create the data source account
 * entity from
 */
function toDsAccountEntity(dbEntity) {
  if (!_.isObject(dbEntity)) return dbEntity;

  const entity = { ...dbEntity };
  entity.id = accountIdCompositeKey.decode(dbEntity);
  delete entity.pk;
  delete entity.sk;

  if (_.isEmpty(entity.status)) {
    // We always default to reachable in the status.
    // Remember that we use the 'status' attribute in the index and we need to ensure
    // that when status == reachable that we remove the status attribute from the database
    entity.status = 'reachable';
  }

  return entity;
}

function toDbEntity(entity, overridingProps = {}) {
  const dbEntity = { ...entity, ...overridingProps };

  delete dbEntity.id;
  // Remember that we use the 'status' attribute in the index and we need to ensure
  // that when status == reachable that we remove the status attribute from the database
  if (dbEntity.status === 'reachable') {
    delete dbEntity.status;
  }

  const statusMsg = dbEntity.statusMsg;
  if (_.isString(statusMsg) && _.isEmpty(statusMsg)) {
    delete dbEntity.statusMsg;
  }

  return dbEntity;
}

module.exports = {
  toDsAccountEntity,
  toDbEntity,
};
