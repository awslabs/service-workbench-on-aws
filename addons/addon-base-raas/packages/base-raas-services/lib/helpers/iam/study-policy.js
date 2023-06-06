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

const { normalizeS3Arn, toS3Arn, normalizeBucketArn, parseS3Arn } = require('../s3-arn');

class StudyPolicy {
  constructor() {
    // Internal data structures:

    // A map of study entries. The key is the normalized s3 arn and the value is a study item. The study
    // item has this shape: { bucketArn, kmsArn, prefix, prefixArn, permission }, where permission
    // is { read, write }. For the case of open data, it is possible that we can have multiple
    // keys (normalized s3 arn>) containing the same study item information.
    this.studies = {};

    this.roleArns = []; // A list of study role arns
  }

  addStudyRole(roleArn) {
    if (_.isEmpty(roleArn)) return;
    this.roleArns = _.uniq([...this.roleArns, roleArn]);
  }

  addStudy({ bucket, awsPartition = 'aws', kmsArn, folder, resources, permission, id = undefined }) {
    assertStudy({ bucket, folder, resources });
    assertPermission({ folder, permission });

    let bucketArn;
    let prefixArn;

    if (!_.isEmpty(folder)) {
      prefixArn = toS3Arn({ bucket, awsPartition, folder });
      bucketArn = normalizeBucketArn(prefixArn);
      this.studies[prefixArn] = { bucketArn, kmsArn, prefix: folder, prefixArn, permission, id };
    } else {
      _.forEach(resources, resource => {
        prefixArn = normalizeS3Arn(resource.arn);
        bucketArn = normalizeBucketArn(prefixArn);
        const { prefix } = parseS3Arn(prefixArn);
        this.studies[prefixArn] = { bucketArn, kmsArn, prefix, prefixArn, permission, id };
      });
    }
  }

  removeStudy({ bucket, awsPartition = 'aws', folder, resources }) {
    assertStudy({ bucket, folder, resources });
    if (!_.isEmpty(folder)) {
      delete this.studies[toS3Arn({ bucket, awsPartition, folder })];
    } else {
      _.forEach(resources, resource => {
        delete this.studies[normalizeS3Arn(resource)];
      });
    }
  }

  // This function is used to create the managed policy doc that will be used as the filesystem role's permissions boundary
  // Therefore it needs to separate study folders by the VPC endpoints they are mapped to, and create boundary accordingly
  // vpcEpStudyMap Object structure: { VPCEndpoint1: [study1, study2,...], VPCEndpoint2: [study3], ... }
  toPolicyDocVpcEndpointSeparated(vpcEpStudyMap) {
    const readwriteStudies = _.filter(_.values(this.studies), ['permission', { read: true, write: true }]);
    const readonlyStudies = _.filter(_.values(this.studies), ['permission', { read: true, write: false }]);
    const readwriteStudyIds = _.map(readwriteStudies, 'id');
    const readonlyStudyIds = _.map(readonlyStudies, 'id');

    const statements = [];

    const createStatementsForVpce = (vpce, validStudyIds) => {
      // Create statement for ReadOnly with same VPCE

      // Consider all RO study IDs here, and intersect only with the ones we want to assign to this VPC EP
      const studyIdsForReadAccess = _.intersection(readonlyStudyIds, validStudyIds);
      if (!_.isEmpty(studyIdsForReadAccess)) {
        statements.push({
          Condition: {
            StringEquals: {
              'aws:SourceVpce': vpce,
            },
          },
          Action: ['s3:GetObject', 's3:GetObjectTagging', 's3:GetObjectVersion', 's3:GetObjectVersionTagging'],
          // this.studies has an id field. Get study where id in studyIdsForReadAccess (map does that)
          // For the study body, get prefixArn field value, return with * suffix
          Resource: _.map(studyIdsForReadAccess, studyId => `${_.find(this.studies, { id: studyId }).prefixArn}*`),
          Effect: 'Allow',
          Sid: `AllowReadFrom${vpce.split('-')[1]}`, // Managed Policy Sid cannot have anything but alphanumeric chars
        });
      }

      // Consider all RW study IDs here, and intersect only with the ones we want to assign to this VPC EP
      const studyIdsForReadWriteAccess = _.intersection(readwriteStudyIds, validStudyIds);
      // Create statement for ReadWrite with same VPCE
      if (!_.isEmpty(studyIdsForReadWriteAccess)) {
        statements.push({
          Condition: {
            StringEquals: {
              'aws:SourceVpce': vpce,
            },
          },
          Action: [
            's3:GetObject',
            's3:GetObjectTagging',
            's3:GetObjectVersion',
            's3:GetObjectVersionTagging',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:PutObjectTagging',
            's3:PutObjectVersionTagging',
            's3:DeleteObject',
            's3:DeleteObjectTagging',
            's3:DeleteObjectVersion',
            's3:DeleteObjectVersionTagging',
          ],
          Resource: _.map(studyIdsForReadWriteAccess, studyId => `${_.find(this.studies, { id: studyId }).prefixArn}*`),
          Effect: 'Allow',
          Sid: `AllowReadWriteFrom${vpce.split('-')[1]}`, // Managed Policy Sid cannot have anything but alphanumeric chars
        });
      }

      // Consider all study IDs here, and intersect only with the ones we want to assign to this VPC EP
      const studyIdsForListAccess = _.intersection(_.union(readwriteStudyIds, readonlyStudyIds), validStudyIds);
      // Create statement for List with same VPCE
      const buckets = this.groupByBucketFilterByStudyIds(studyIdsForListAccess);
      let counter = 0;
      _.forEach(buckets, (studies, bucketArn) => {
        counter += 1;
        statements.push({
          Sid: `AllowListFrom${vpce.split('-')[1]}Count${counter}`,
          Effect: 'Allow',
          Action: ['s3:ListBucket', 's3:ListBucketVersions'],
          Resource: bucketArn,
          Condition: {
            StringLike: {
              's3:prefix': _.map(studies, study => {
                const prefix = study.prefix;
                // We need to account for the fact that a study might be the whole bucket, and when this
                // is the case, the s3:prefix entry should be "*" and not "/*"
                return prefix === '/' ? '*' : `${prefix}*`;
              }),
            },
            StringEquals: {
              'aws:SourceVpce': vpce,
            },
          },
        });
      });

      return statements;
    };

    // For each unique VPC Endpoint, add a condition to limit their respective study access from that endpoint
    const vpcEndpoints = Object.keys(vpcEpStudyMap);
    _.forEach(vpcEndpoints, vpcEndpoint => createStatementsForVpce(vpcEndpoint, vpcEpStudyMap[vpcEndpoint]));

    // Add kms key permissions
    const kmsArns = this.getKmsArns();
    if (!_.isEmpty(kmsArns)) {
      statements.push({
        Sid: 'studyKMSAccess',
        Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
        Effect: 'Allow',
        Resource: kmsArns,
      });
    }

    // Add any assume role for any study role arns
    const roleArns = this.roleArns;
    if (!_.isEmpty(roleArns)) {
      statements.push({
        Sid: 'studyAssumeRoles',
        Action: ['sts:AssumeRole'],
        Effect: 'Allow',
        Resource: roleArns,
      });
    }

    if (_.isEmpty(statements)) return {};

    return {
      Version: '2012-10-17',
      Statement: statements,
    };
  }

  toPolicyDoc() {
    const readwriteStudies = _.filter(_.values(this.studies), ['permission', { read: true, write: true }]);
    const readonlyStudies = _.filter(_.values(this.studies), ['permission', { read: true, write: false }]);
    const statements = [];

    // Add a statement to allow for reading objects
    if (!_.isEmpty(readonlyStudies)) {
      statements.push({
        Sid: 'S3StudyReadAccess',
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:GetObjectTagging', 's3:GetObjectVersion', 's3:GetObjectVersionTagging'],
        Resource: _.map(readonlyStudies, study => `${study.prefixArn}*`),
      });
    }

    // Add a statement to allow for reading and writing objects
    if (!_.isEmpty(readwriteStudies)) {
      statements.push({
        Sid: 'S3StudyReadWriteAccess',
        Effect: 'Allow',
        Action: [
          's3:GetObject',
          's3:GetObjectTagging',
          's3:GetObjectVersion',
          's3:GetObjectVersionTagging',
          's3:AbortMultipartUpload',
          's3:ListMultipartUploadParts',
          's3:PutObject',
          's3:PutObjectAcl',
          's3:PutObjectTagging',
          's3:PutObjectVersionTagging',
          's3:DeleteObject',
          's3:DeleteObjectTagging',
          's3:DeleteObjectVersion',
          's3:DeleteObjectVersionTagging',
        ],
        Resource: _.map(readwriteStudies, study => `${study.prefixArn}*`),
      });
    }

    // This time we need to add a statement per bucket to allow for listing the applicable studies.
    const buckets = this.groupByBucket();
    let counter = 0;
    _.forEach(buckets, (studies, bucketArn) => {
      counter += 1;
      statements.push({
        Sid: `studyListS3Access${counter}`,
        Effect: 'Allow',
        Action: ['s3:ListBucket', 's3:ListBucketVersions'],
        Resource: bucketArn,
        Condition: {
          StringLike: {
            's3:prefix': _.map(studies, study => {
              const prefix = study.prefix;
              // We need to account for the fact that a study might be the whole bucket, and when this
              // is the case, the s3:prefix entry should be "*" and not "/*"
              return prefix === '/' ? '*' : `${prefix}*`;
            }),
          },
        },
      });
    });

    // Add kms key permissions
    const kmsArns = this.getKmsArns();
    if (!_.isEmpty(kmsArns)) {
      statements.push({
        Sid: 'studyKMSAccess',
        Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
        Effect: 'Allow',
        Resource: kmsArns,
      });
    }

    // Add any assume role for any study role arns
    const roleArns = this.roleArns;
    if (!_.isEmpty(roleArns)) {
      statements.push({
        Sid: 'studyAssumeRoles',
        Action: ['sts:AssumeRole'],
        Effect: 'Allow',
        Resource: roleArns,
      });
    }

    if (_.isEmpty(statements)) return {};

    return {
      Version: '2012-10-17',
      Statement: statements,
    };
  }

  createPolicyDocAddStatements(statements) {
    const policyDoc = this.toPolicyDoc();
    policyDoc.Statement.push(...statements);
    return policyDoc;
  }

  groupByBucketFilterByStudyIds(studyIdsToUse) {
    // The key of the map is the bucketArn, the value is an array of all the studies in the bucket
    const map = {};
    _.forEach(this.studies, study => {
      if (_.includes(studyIdsToUse, study.id)) {
        const entry = map[study.bucketArn] || [];
        map[study.bucketArn] = entry;

        entry.push(study);
      }
    });
    return map;
  }

  groupByBucket() {
    // The key of the map is the bucketArn, the value is an array of all the studies in the bucket
    const map = {};
    _.forEach(this.studies, study => {
      const entry = map[study.bucketArn] || [];
      map[study.bucketArn] = entry;

      entry.push(study);
    });
    return map;
  }

  getKmsArns() {
    const kmsArnsMap = {};
    _.forEach(this.studies, study => {
      if (_.isEmpty(study.kmsArn)) return;
      kmsArnsMap[study.kmsArn] = true;
    });

    return _.keys(kmsArnsMap);
  }
}

// @private
function assertStudy({ bucket, folder = '', resources = [] } = {}) {
  const errors = [];

  if (_.isEmpty(folder) && _.isEmpty(resources)) {
    errors.push('A study without a folder or resources was provided to a study policy instance');
  }

  if (!_.isEmpty(folder) && _.isEmpty(bucket)) {
    errors.push(`A study a folder '${folder}' was provided without a bucket name to a study policy instance`);
  }

  if (_.isEmpty(errors)) return;
  throw new Error(
    `Invalid study '${folder ||
      resources.join(',')}' and/or bucket information was provided to a study policy instance. ${errors.join('. ')}`,
  );
}

// @private
function assertPermission({ folder, resources, permission }) {
  const hasRead = _.has(permission, 'read');
  const hasWrite = _.has(permission, 'write');

  if (!hasRead || !hasWrite) {
    const studyInfo = `${folder} || ${_.map(resources, res => res.arn).join(', ')}`;
    throw new Error(
      `Invalid permission object '${permission}' for study '${studyInfo}' was provided to a study policy instance`,
    );
  }
}

module.exports = { StudyPolicy };
