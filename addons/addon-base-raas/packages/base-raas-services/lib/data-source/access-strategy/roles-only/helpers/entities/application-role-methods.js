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

const { StudyPolicy } = require('../../../../../helpers/iam/study-policy');
const { isReadonly, isWriteonly, isReadwrite } = require('../../../../../study/helpers/entities/study-methods');

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

function maxReached(appRoleEntity = {}, maxSize = 6 * 1024 - 255) {
  // The max characters count for a managed policy is 6k, we add some buffer here (255 character).

  // Generate the json boundary policy doc and count its characters
  // Notice that we count the permission boundary policy doc characters and not role doc characters
  // because the boundary policy is always going to run out of space before the role doc.

  const policyDoc = JSON.stringify(toManagedPolicyCfnResource(appRoleEntity));
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

function newAppRoleEntity(accountEntity = {}, bucketEntity = {}, studyEntity = {}) {
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
    bucketRegion: region,
    mainRegion: accountEntity.mainRegion,
    awsPartition,
    status: 'pending',
    statusAt: new Date().toISOString(),
  };
}

/**
 * Returns a json object that represents the cfn role resource as described in
 * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html
 *
 * The output shape is
 * {
 *   'logicalId': <logical id>,
 *   'resource': {
 *    {
 *      "Type" : "AWS::IAM::Role",
 *      "Properties" : {
 *        "RoleName" : String,
 *        "AssumeRolePolicyDocument" : Json,
 *        "Description" : String,
 *        "ManagedPolicyArns" : [ String, ... ],
 *        "MaxSessionDuration" : Integer,
 *        "Policies" : [ Policy, ... ],
 *      }
 *    }
 *   'comment': 'Future enhancement'
 * }
 *
 * @param appRoleEntity The application role entity
 */
function toRoleCfnResource(appRoleEntity, swbMainAccountId) {
  const { name, accountId, qualifier, boundaryPolicyArn } = appRoleEntity;

  // cfn logical id can not have '-'
  const logicalId = `AppRole${_.replace(name, /-/g, '')}`;
  return {
    logicalId,
    resource: {
      Type: 'AWS::IAM::Role',
      Properties: {
        RoleName: name,
        AssumeRolePolicyDocument: toTrustPolicyDoc(swbMainAccountId),
        Description: 'An application role that allows the SWB application to create roles to access studies',
        ManagedPolicyArns: [{ Ref: getManagedPolicyLogicalId(appRoleEntity) }],
        // 12 hours see
        // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html#cfn-iam-role-maxsessionduration
        MaxSessionDuration: 43200,
        Policies: [
          {
            PolicyName: 'swb-app-role-essentials',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                // We can't simply ask for open ended storagegateway access, this is something we need to rethink it
                // {
                //   Sid: 'StorageGatewayAccess',
                //   Action: 'storagegateway:*',
                //   Effect: 'Allow',
                //   Resource: '*',
                // },
                {
                  Sid: 'RoleAndPolicyManagement',
                  Effect: 'Allow',
                  Action: [
                    'iam:CreatePolicy',
                    'iam:UpdateAssumeRolePolicy',
                    'iam:AttachRolePolicy',
                    'iam:PutRolePolicy',
                    'iam:DeletePolicy',
                    'iam:DeleteRolePolicy',
                    'iam:DeleteRole',
                    'iam:GetPolicy',
                    'iam:GetRole',
                    'iam:GetRolePolicy',
                  ],
                  Resource: [
                    `arn:aws:iam::${accountId}:role/${qualifier}-*`,
                    `arn:aws:iam::${accountId}:policy/${qualifier}-*`,
                  ],
                },
                {
                  Sid: 'RoleCreation',
                  Effect: 'Allow',
                  Action: 'iam:CreateRole',
                  Resource: `arn:aws:iam::${accountId}:role/${qualifier}-*`,
                  Condition: {
                    StringEquals: {
                      'iam:PermissionsBoundary': boundaryPolicyArn,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
}

/**
 * Returns a json object that represents the cfn managed policy resource as described in
 * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-managedpolicy.html#cfn-iam-managedpolicy-roles
 *
 * The output shape is
 * {
 *   'logicalId': <logical id>,
 *   'resource': {
 *     "Type" : "AWS::IAM::ManagedPolicy",
 *     "Properties" : {
 *       "Description" : String,
 *       "ManagedPolicyName" : String,
 *       "Path" : String,
 *       "PolicyDocument" : Json,
 *     }
 *   }
 *   'comment': 'Future enhancement'
 * }
 *
 * @param appRoleEntity The application role entity
 */
function toManagedPolicyCfnResource(appRoleEntity) {
  const { name, studies, bucket, bucketKmsArn, awsPartition } = appRoleEntity;

  const studyPolicy = new StudyPolicy();

  _.forEach(studies, study => {
    const { folder, kmsArn, kmsScope } = study;
    const item = {
      bucket,
      awsPartition,
      folder,
      permission: {
        read: isReadonly(study) || isReadwrite(study),
        write: isReadwrite(study) || isWriteonly(study),
      },
    };

    if (kmsScope === 'bucket') {
      item.kmsArn = bucketKmsArn;
    } else if (kmsScope === 'study') {
      item.kmsArn = kmsArn;
    }

    studyPolicy.addStudy(item);
  });

  return {
    logicalId: getManagedPolicyLogicalId(appRoleEntity),
    resource: {
      Type: 'AWS::IAM::ManagedPolicy',
      Properties: {
        Description: 'A managed policy that is used as the permission boundary for all roles that are created by SWB',
        ManagedPolicyName: name,
        PolicyDocument: studyPolicy.toPolicyDoc(),
      },
    },
  };
}

function toTrustPolicyDoc(swbMainAccountId) {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: swbMainAccountId },
        Action: ['sts:AssumeRole'],
      },
    ],
  };
}

function getManagedPolicyLogicalId(appRoleEntity) {
  const { name } = appRoleEntity;

  // cfn logical id can not have '-'
  const logicalId = _.replace(name, /-/g, '');
  return `ManagedPolicy${logicalId}`;
}

/**
 * Returns an array of the following shape:
 * [ { logicalId: <logicalId>, resource }, ... ]
 */
function toCfnResources(appRoleEntity, swbMainAccountId) {
  const managedPolicy = toManagedPolicyCfnResource(appRoleEntity);
  const role = toRoleCfnResource(appRoleEntity, swbMainAccountId);

  return [managedPolicy, role];
}

module.exports = {
  toAppRoleEntity,
  toDbEntity,
  newAppRoleEntity,
  addStudy,
  maxReached,
  toCfnResources,
};
