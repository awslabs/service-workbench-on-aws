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
const path = require('path');
const _ = require('lodash');
const nanoid = require('nanoid');

function generateId() {
  // Note: we don't use the default alphabet that comes with nanoid because it contains '_'
  // which is not an allowed character for cloudformation stack names and role names
  const generator = nanoid.customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 22);
  return generator();
}

// remove the "end" string from "str" if it exists
function chopRight(str = '', end = '') {
  if (!_.endsWith(str, end)) return str;
  return str.substring(0, str.length - end.length);
}

// remove the "start" string from "str" if it exists
function chopLeft(str = '', start = '') {
  if (!_.startsWith(str, start)) return str;
  return str.substring(start.length);
}

/**
 * A normalized study folder (a.k.a prefix) should have no leading forward slash but should have a trailing
 * forward slash. If the study is the whole bucket, then the a normalized study folder should be '/'.
 */
function normalizeStudyFolder(str = '') {
  // First we want to make sure that all '../' are resolved now.
  // Note: path.resolve, will also remove any trailing forward slashes
  let resolved = path.resolve('/', str);

  // If the whole path is just '/' then return it as is. This is the case when the whole bucket might be the study
  if (resolved === '/') return '/';

  // Remove the leading forward slash if present
  resolved = chopLeft(resolved, '/');
  // Add a trailing forward slash if missing
  return _.endsWith(resolved, '/') ? resolved : `${resolved}/`;
}

async function updateS3BucketPolicy(s3Client, s3BucketName, s3Policy, revisedStatements) {
  // remove all the old statements from s3Policy that have changed
  const revisedStatementIds = revisedStatements.flat().map(statement => statement.Sid);
  s3Policy.Statement = s3Policy.Statement.filter(statement => !revisedStatementIds.includes(statement.Sid));

  // add all the revised statements to the s3Policy
  revisedStatements.flat().forEach(statement => {
    // Only add updated statement if it contains principals (otherwise leave it out)
    if (statement.Principal.AWS.length > 0) {
      s3Policy.Statement.push(statement);
    }
  });
  try {
    await s3Client.putBucketPolicy({ Bucket: s3BucketName, Policy: JSON.stringify(s3Policy) }).promise();
  } catch (error) {
    console.error(
      `Failed updating bucket policy: ${JSON.stringify(
        s3Policy,
      )} for bucket: ${s3BucketName}. Check if original bucket policy is too large`,
    );
    console.error(error);
  }
  // Update S3 bucket policy
}

function createAllowStatement(statementId, actions, resource, condition) {
  const baseAllowStatement = {
    Sid: statementId,
    Effect: 'Allow',
    Principal: { AWS: [] },
    Action: actions,
    Resource: resource,
  };
  if (condition) {
    baseAllowStatement.Condition = condition;
  }
  return baseAllowStatement;
}

function getRootArnForAccount(memberAccountId) {
  return `arn:aws:iam::${memberAccountId}:root`;
}

function addEmptyPrincipalIfNotPresent(statement) {
  if (!statement.Principal) {
    statement.Principal = {};
  }
  if (!statement.Principal.AWS) {
    statement.Principal.AWS = [];
  }
  return statement;
}

const getStatementParamsFn = (bucket, prefix) => {
  return {
    statementId: `Get:${prefix}`,
    resource: [`arn:aws:s3:::${bucket}/${prefix}*`],
    actions: ['s3:GetObject'],
  };
};

const listStatementParamsFn = (bucket, prefix) => {
  return {
    statementId: `List:${prefix}`,
    resource: `arn:aws:s3:::${bucket}`,
    actions: ['s3:ListBucket'],
    condition: {
      StringLike: {
        's3:prefix': [`${prefix}*`],
      },
    },
  };
};

const putStatementParamsFn = (bucket, prefix) => {
  return {
    statementId: `Put:${prefix}`,
    resource: [`arn:aws:s3:::${bucket}/${prefix}*`],
    actions: [
      's3:GetObject',
      's3:GetObjectVersion',
      's3:GetObjectTagging',
      's3:AbortMultipartUpload',
      's3:ListMultipartUploadParts',
      's3:PutObject',
      's3:PutObjectAcl',
      's3:PutObjectTagging',
      's3:DeleteObject',
      's3:DeleteObjectVersion',
    ],
  };
};

function addAccountToStatement(oldStatement, memberAccountId) {
  const principal = getRootArnForAccount(memberAccountId);
  const statement = addEmptyPrincipalIfNotPresent(oldStatement);
  if (Array.isArray(statement.Principal.AWS)) {
    // add the principal if it doesn't exist already
    if (!statement.Principal.AWS.includes(principal)) {
      statement.Principal.AWS.push(principal);
    }
  } else if (statement.Principal.AWS !== principal) {
    statement.Principal.AWS = [statement.Principal.AWS, principal];
  }
  return statement;
}

async function getRevisedS3Statements(s3Policy, studyEntity, bucket, statementParamFunctions, updateStatementFn) {
  const revisedStatementsPerStudy = _.map(statementParamFunctions, statementParameterFn => {
    const statementParams = statementParameterFn(bucket, studyEntity.prefix);
    let oldStatement = s3Policy.Statement.find(statement => statement.Sid === statementParams.statementId);
    if (!oldStatement) {
      oldStatement = createAllowStatement(
        statementParams.statementId,
        statementParams.actions,
        statementParams.resource,
        statementParams.condition,
      );
    }
    const newStatement = updateStatementFn(oldStatement);
    return newStatement;
  });
  return revisedStatementsPerStudy;
}

function removeAccountFromStatement(oldStatement, memberAccountId) {
  const principal = getRootArnForAccount(memberAccountId);
  const statement = addEmptyPrincipalIfNotPresent(oldStatement);
  if (Array.isArray(statement.Principal.AWS)) {
    statement.Principal.AWS = statement.Principal.AWS.filter(oldPrincipal => oldPrincipal !== principal);
  } else if (statement.Principal.AWS === principal) {
    statement.Principal.AWS = [];
  }
  return statement;
}

module.exports = {
  generateId,
  chopRight,
  chopLeft,
  normalizeStudyFolder,
  updateS3BucketPolicy,
  createAllowStatement,
  getRootArnForAccount,
  addEmptyPrincipalIfNotPresent,
  getStatementParamsFn,
  listStatementParamsFn,
  putStatementParamsFn,
  addAccountToStatement,
  getRevisedS3Statements,
  removeAccountFromStatement,
};
