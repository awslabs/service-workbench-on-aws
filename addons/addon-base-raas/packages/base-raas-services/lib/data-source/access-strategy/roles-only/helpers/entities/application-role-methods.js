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
 * applicationRoleEntity. Think of these functions as derived attributes
 * or functions that are part of the applicationRoleEntity.
 */

const _ = require('lodash');

const { appRoleIdCompositeKey } = require('../composite-keys');

function addStudy(appRoleEntity = {}, studyEntity = {}) {
  const { id, folder, kmsArn, kmsScope, accessType } = studyEntity;
  appRoleEntity.studies[id] = {
    folder,
    kmsArn,
    kmsScope,
    accessType,
  };

  return appRoleEntity;
}

function maxReached(appRoleEntity = {}) {
  // TODO - generate the json boundary policy doc and count its characters
  // Notice that we could the permission boundary policy doc characters and not role doc characters
  // because the boundary policy is always going to run out of space before the role doc.

  const policyDoc = ''; // TODO
  const maxSize = 6 * 1024 - 300; // TODO - the max size (also add some buffer here (300 character))
  return _.size(policyDoc) >= maxSize;
}

/**
 * Returns an application entity given its db entity version.
 *
 * @param dbEntity The db entity (a.k.a db record) to use to create the application entity from
 */
function toAppRoleEntity(dbEntity) {
  if (!_.isObject(dbEntity)) return dbEntity;

  const entity = { ...dbEntity };
  const { accountId, arn } = appRoleIdCompositeKey.decode(entity);
  entity.accountId = accountId;
  entity.arn = arn;
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

function toDbEntity(appRoleEntity, by) {
  const dbEntity = { ...appRoleEntity };
  delete dbEntity.accountId;

  // Remember that we use the 'status' attribute in the index and we need to ensure
  // that when status == reachable that we remove the status attribute from the database
  if (dbEntity.status === 'reachable') {
    delete dbEntity.status;
  }

  const statusMsg = dbEntity.statusMsg;
  if (_.isString(statusMsg) && _.isEmpty(statusMsg)) {
    delete dbEntity.statusMsg;
  }

  if (_.isEmpty(by)) return dbEntity;

  dbEntity.updatedBy = by;

  if (_.isEmpty(dbEntity.createdBy)) {
    dbEntity.createdBy = by;
  }

  return dbEntity;
}

function newAppRoleEntity(bucketEntity = {}, studyEntity = {}) {
  const { accountId, awsPartition, qualifier, bucket, region, folder, kmsArn, kmsScope, accessType } = studyEntity;
  const now = Date.now();
  const name = `${qualifier}-app-${now}`;
  const arn = `arn:${awsPartition}:iam::${accountId}:role/${name}`;
  const boundaryPolicyArn = `arn:${awsPartition}:iam::${accountId}:policy/${name}`;
  return {
    accountId,
    arn,
    name,
    qualifier,
    studies: {
      [studyEntity.id]: {
        folder,
        kmsArn,
        kmsScope,
        accessType,
      },
    },
    boundaryPolicyArn,
    bucket,
    bucketKmsArn: bucketEntity.kmsArn,
    region,
    awsPartition,
    status: 'pending',
    statusAt: new Date().toISOString(),
  };
}

module.exports = {
  toAppRoleEntity,
  toDbEntity,
  newAppRoleEntity,
  addStudy,
  maxReached,
};
