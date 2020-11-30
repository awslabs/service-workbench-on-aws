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
 * bucketEntity. Think of these functions as derived attributes
 * or functions that are part of the bucketEntity.
 */

const _ = require('lodash');

const { bucketIdCompositeKey } = require('../composite-keys');

/**
 * Returns the bucket entity given its db entity version.
 *
 * @param dbEntity The db entity (a.k.a db record) to use to create the bucket entity from
 */
function toBucketEntity(dbEntity) {
  if (!_.isObject(dbEntity)) return dbEntity;

  const entity = { ...dbEntity };
  const { accountId, name } = bucketIdCompositeKey.decode(entity);

  entity.accountId = accountId;
  entity.name = name;
  delete entity.pk;
  delete entity.sk;

  return entity;
}

function toDbEntity(entity, overridingProps = {}) {
  const dbEntity = { ...entity, ...overridingProps };

  delete dbEntity.accountId;
  delete dbEntity.name;

  const statusMsg = dbEntity.statusMsg;
  if (_.isString(statusMsg) && _.isEmpty(statusMsg)) {
    delete dbEntity.statusMsg;
  }

  return dbEntity;
}

module.exports = {
  toBucketEntity,
  toDbEntity,
};
