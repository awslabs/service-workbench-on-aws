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
const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  environmentInstanceFiles: 'environmentInstanceFiles',
  studyDataBucketName: 'studyDataBucketName',
  studyDataKmsKeyAlias: 'studyDataKmsKeyAlias',
  studyDataKmsKeyArn: 'studyDataKmsKeyArn',
  studyDataKmsPolicyWorkspaceSid: 'studyDataKmsPolicyWorkspaceSid',
};

const parseS3Arn = arn => {
  const path = arn.slice('arn:aws:s3:::'.length);
  const slashIndex = path.indexOf('/');
  return slashIndex !== -1
    ? {
        bucket: path.slice(0, slashIndex),
        prefix: arn.slice(arn.indexOf('/') + 1),
      }
    : {
        bucket: path,
        prefix: '/',
      };
};

class EnvironmentMountService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'lockService', 'studyService', 'studyPermissionService', 'storageGatewayService']);
  }

  async getCfnStudyAccessParameters(requestContext, rawDataV1) {
    const studyIds = _.get(rawDataV1, 'instanceInfo.files'); // Yes, studyIds are named "files" in rawDataV1
    return this.getStudyAccessInfo(requestContext, studyIds);
  }

  async getStudyAccessInfo(requestContext, studyIds) {
    const studyInfo = await this._getStudyInfo(requestContext, studyIds);
    await this._validateStudyPermissions(requestContext, studyInfo);
    const s3Mounts = this._prepareS3Mounts(studyInfo);
    const iamPolicyDocument = await this._generateIamPolicyDoc(studyInfo);

    return {
      s3Mounts: JSON.stringify(s3Mounts.map(({ id, bucket, prefix }) => ({ id, bucket, prefix }))),
      iamPolicyDocument: JSON.stringify(iamPolicyDocument),
      environmentInstanceFiles: this.settings.get(settingKeys.environmentInstanceFiles),
      s3Prefixes: s3Mounts.filter(({ category }) => category !== 'Open Data').map(mount => mount.prefix),
    };
  }

  async addRoleArnToLocalResourcePolicies(workspaceRoleArn, s3Prefixes) {
    // Define function to handle updating resource policy principals where the current principals
    // may be an array or a string
    const updateAwsPrincipals = (awsPrincipals, newPrincipal) => {
      if (Array.isArray(awsPrincipals)) {
        awsPrincipals.push(newPrincipal);
      } else {
        awsPrincipals = [awsPrincipals, newPrincipal];
      }
      return awsPrincipals;
    };

    return this._updateResourcePolicies({ updateAwsPrincipals, workspaceRoleArn, s3Prefixes });
  }

  async removeRoleArnFromLocalResourcePolicies(workspaceRoleArn, s3Prefixes) {
    // Define function to handle updating resource policy principals where the current principals
    // may be an array or a string
    const updateAwsPrincipals = (awsPrincipals, removedPrincipal) => {
      if (Array.isArray(awsPrincipals)) {
        awsPrincipals = awsPrincipals.filter(principal => principal !== removedPrincipal);
      } else {
        awsPrincipals = [];
      }
      return awsPrincipals;
    };

    return this._updateResourcePolicies({ updateAwsPrincipals, workspaceRoleArn, s3Prefixes });
  }

  async updateStudyFileMountIPAllowList(requestContext, existingEnvironment, ipAllowListAction) {
    const [storageGatewayService, studyService] = await this.service(['storageGatewayService', 'studyService']);
    // Check if the mounted study is using StorageGateway
    const studiesList = await studyService.listByIds(
      requestContext,
      existingEnvironment.studyIds.map(id => {
        return { id };
      }),
    );

    // If yes, get the file share ARNs and call to update IP allow list
    const fileShareARNs = studiesList.map(study => study.resources[0].fileShareArn).filter(arn => !_.isUndefined(arn));
    if (!_.isEmpty(fileShareARNs)) {
      let ip;
      // If IP is in ipAllowListAction, use that, if not, find it in existingEnvironment
      if ('ip' in ipAllowListAction) {
        ip = ipAllowListAction.ip;
      } else {
        ip = existingEnvironment.outputs.filter(output => output.OutputKey === 'Ec2WorkspaceInstanceId')[0].OutputValue;
      }
      await storageGatewayService.updateFileShareIPAllowedList(fileShareARNs, ip, ipAllowListAction.action);
    }
  }

  async _updateResourcePolicies({ updateAwsPrincipals, workspaceRoleArn, s3Prefixes }) {
    if (s3Prefixes.length === 0) {
      return;
    }

    // Get S3 and KMS resource names
    const s3BucketName = this.settings.get(settingKeys.studyDataBucketName);
    let kmsKeyAlias = this.settings.get(settingKeys.studyDataKmsKeyAlias);
    if (!kmsKeyAlias.startsWith('alias/')) {
      kmsKeyAlias = `alias/${kmsKeyAlias}`;
    }

    // Setup services and SDK clients
    const [aws, lockService] = await this.service(['aws', 'lockService']);
    const s3Client = new aws.sdk.S3();
    const kmsClient = new aws.sdk.KMS();

    // Perform locked updates to prevent inconsistencies from race conditions
    const s3LockKey = `s3|bucket-policy|${s3BucketName}`;
    const kmsLockKey = `kms|key-policy|${kmsKeyAlias}`;
    await Promise.all([
      // Update S3 bucket policy
      lockService.tryWriteLockAndRun({ id: s3LockKey }, async () => {
        // Get existing policy
        const s3Policy = JSON.parse((await s3Client.getBucketPolicy({ Bucket: s3BucketName }).promise()).Policy);

        // Get statements for listing and reading study data, respectively
        const statements = s3Policy.Statement;
        s3Prefixes.forEach(prefix => {
          const listSid = `List:${prefix}`;
          const getSid = `Get:${prefix}`;

          // Define default statements to be used if we can't find existing ones
          let listStatement = {
            Sid: listSid,
            Effect: 'Allow',
            Principal: { AWS: [] },
            Action: 's3:ListBucket',
            Resource: `arn:aws:s3:::${s3BucketName}`,
            Condition: {
              StringLike: {
                's3:prefix': [`${prefix}*`],
              },
            },
          };
          let getStatement = {
            Sid: getSid,
            Effect: 'Allow',
            Principal: { AWS: [] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${s3BucketName}/${prefix}*`],
          };

          // Pull out existing statements if available
          statements.forEach(statement => {
            if (statement.Sid === listSid) {
              listStatement = statement;
            } else if (statement.Sid === getSid) {
              getStatement = statement;
            }
          });

          // Update statement and policy
          // NOTE: The S3 API *should* remove duplicate principals, if any
          listStatement.Principal.AWS = updateAwsPrincipals(listStatement.Principal.AWS, workspaceRoleArn);
          getStatement.Principal.AWS = updateAwsPrincipals(getStatement.Principal.AWS, workspaceRoleArn);

          s3Policy.Statement = s3Policy.Statement.filter(statement => ![listSid, getSid].includes(statement.Sid));
          [listStatement, getStatement].forEach(statement => {
            // Only add updated statement if it contains principals (otherwise leave it out)
            if (statement.Principal.AWS.length > 0) {
              s3Policy.Statement.push(statement);
            }
          });
        });

        // Update policy
        await s3Client.putBucketPolicy({ Bucket: s3BucketName, Policy: JSON.stringify(s3Policy) }).promise();
      }),

      // Update KMS key policy
      lockService.tryWriteLockAndRun({ id: kmsLockKey }, async () => {
        // Get existing policy
        const keyId = (await kmsClient.describeKey({ KeyId: kmsKeyAlias }).promise()).KeyMetadata.KeyId;
        const kmsPolicy = JSON.parse(
          (await kmsClient.getKeyPolicy({ KeyId: keyId, PolicyName: 'default' }).promise()).Policy,
        );

        // Get statement
        const sid = this.settings.get(settingKeys.studyDataKmsPolicyWorkspaceSid);
        let environmentStatement = kmsPolicy.Statement.find(statement => statement.Sid === sid);
        if (!environmentStatement) {
          // Create new statement if it doesn't already exist
          environmentStatement = {
            Sid: sid,
            Effect: 'Allow',
            Principal: { AWS: [] },
            Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Resource: '*', // Only refers to this key since it's a resource policy
          };
        }

        // Update policy
        // NOTE: The S3 API *should* remove duplicate principals, if any
        environmentStatement.Principal.AWS = updateAwsPrincipals(environmentStatement.Principal.AWS, workspaceRoleArn);

        kmsPolicy.Statement = kmsPolicy.Statement.filter(statement => statement.Sid !== sid);
        if (environmentStatement.Principal.AWS.length > 0) {
          // Only add updated statement if it contains principals (otherwise leave it out)
          kmsPolicy.Statement.push(environmentStatement);
        }

        await kmsClient
          .putKeyPolicy({ KeyId: keyId, PolicyName: 'default', Policy: JSON.stringify(kmsPolicy) })
          .promise();
      }),
    ]);
  }

  async _getStudyInfo(requestContext, studyIds) {
    let studyInfo = [];
    if (studyIds && studyIds.length) {
      const studyService = await this.service('studyService');
      studyInfo = await Promise.all(
        studyIds.map(async studyId => {
          try {
            const { id, name, category, resources } = await studyService.mustFind(requestContext, studyId);
            return { id, name, category, resources };
          } catch (error) {
            // Because the studies update periodically we cannot
            // guarantee consistency so filter anything invalid here
            return { name: '', resources: [] };
          }
        }),
      );
    }

    return studyInfo;
  }

  async _validateStudyPermissions(requestContext, studyInfo) {
    let permissions = {};
    if (studyInfo.length) {
      // Get requested study IDs
      const requestedStudyIds = studyInfo.map(study => study.id);

      // Retrieve and verify user's study permissions
      const studyPermissionService = await this.service('studyPermissionService');
      const storedPermissions = await studyPermissionService.getRequestorPermissions(requestContext);

      // If there are no stored permissions, use a empty permissions object
      permissions = storedPermissions || studyPermissionService.getEmptyUserPermissions();

      // Add Open Data read access for everyone
      permissions.readonlyAccess = permissions.readonlyAccess.concat(
        studyInfo.filter(study => study.category === 'Open Data').map(study => study.id),
      );

      // Determine whether any forbidden studies were requested
      const allowedStudies = permissions.adminAccess.concat(permissions.readonlyAccess);
      const forbiddenStudies = _.difference(requestedStudyIds, allowedStudies);

      if (forbiddenStudies.length) {
        throw new Error(`Studies not found: ${forbiddenStudies.join(',')}`);
      }
    }
    return permissions;
  }

  _prepareS3Mounts(studyInfo) {
    let mounts = [];
    if (studyInfo.length) {
      // There might be multiple resources. In the future we may flatMap, for now...
      mounts = studyInfo.reduce(
        (result, { id, resources, category }) =>
          result.concat(
            resources.map(resource => {
              const { bucket, prefix } = parseS3Arn(resource.arn);
              return { id, bucket, prefix, category };
            }),
          ),
        [],
      );
    }

    return mounts;
  }

  async _generateIamPolicyDoc(studyInfo) {
    let policyDoc = {};
    if (studyInfo.length) {
      const objectLevelActions = ['s3:GetObject'];

      // Collect study resources
      const objectPathArns = _.flatten(
        studyInfo.map(info =>
          info.resources
            // Pull out resource ARNs
            .map(resource => resource.arn)
            // Only grab S3 ARNs
            .filter(arn => arn.startsWith('arn:aws:s3:'))
            // Normalize the ARNs by ensuring they end with "/*"
            .map(arn => {
              switch (arn.slice(-1)) {
                case '*':
                  break;
                case '/':
                  arn += '*';
                  break;
                default:
                  arn += '/*';
              }

              return arn;
            }),
        ),
      );

      // Build policy statements for object-level permissions
      const statements = [];
      statements.push({
        Sid: 'S3StudyReadAccess',
        Effect: 'Allow',
        Action: objectLevelActions,
        Resource: objectPathArns,
      });

      // Create map of buckets whose paths need list access
      const bucketPaths = {};
      objectPathArns.forEach(arn => {
        const { bucket, prefix } = parseS3Arn(arn);
        if (!(bucket in bucketPaths)) {
          bucketPaths[bucket] = [];
        }
        bucketPaths[bucket].push(prefix);
      });

      // Add bucket list permissions to statements
      let bucketCtr = 1;
      Object.keys(bucketPaths).forEach(bucketName => {
        statements.push({
          Sid: `studyListS3Access${bucketCtr}`,
          Effect: 'Allow',
          Action: 's3:ListBucket',
          Resource: `arn:aws:s3:::${bucketName}`,
          Condition: {
            StringLike: {
              's3:prefix': bucketPaths[bucketName],
            },
          },
        });
        bucketCtr += 1;
      });

      // // Add KMS Permissions
      const studyDataKmsAliasArn = this.settings.get(settingKeys.studyDataKmsKeyArn);

      // Get KMS Key ARN from KMS Alias ARN
      // The "Decrypt","DescribeKey","GenerateDataKey" etc require KMS KEY ARN and not ALIAS ARN
      const [aws] = await this.service(['aws']);
      const kmsClient = new aws.sdk.KMS();
      const data = await kmsClient
        .describeKey({
          KeyId: studyDataKmsAliasArn,
        })
        .promise();
      const studyDataKmsKeyArn = data.KeyMetadata.Arn;
      statements.push({
        Sid: 'studyKMSAccess',
        Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
        Effect: 'Allow',
        Resource: studyDataKmsKeyArn,
      });

      // Build final policyDoc
      policyDoc = {
        Version: '2012-10-17',
        Statement: statements,
      };
    }

    return policyDoc;
  }
}

module.exports = EnvironmentMountService;
