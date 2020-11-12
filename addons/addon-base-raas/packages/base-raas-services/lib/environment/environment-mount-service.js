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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

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
    this.dependency([
      'aws',
      'lockService',
      'studyService',
      'studyPermissionService',
      'environmentScService',
      'iamService',
    ]);
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
          const putSid = `Put:${prefix}`;

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
          // Read Permission
          let getStatement = {
            Sid: getSid,
            Effect: 'Allow',
            Principal: { AWS: [] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${s3BucketName}/${prefix}*`],
          };
          // Write Permission
          let putStatement = {
            Sid: putSid,
            Effect: 'Allow',
            Principal: { AWS: [] },
            Action: ['s3:PutObject'],
            Resource: [`arn:aws:s3:::${s3BucketName}/${prefix}*`],
          };
          // For writeable permission, PutObjectAcl is not required on the S3 bucket policy
          // but is required on Workspace Role policy

          // Pull out existing statements if available
          statements.forEach(statement => {
            if (statement.Sid === listSid) {
              listStatement = statement;
            } else if (statement.Sid === getSid) {
              getStatement = statement;
            } else if (statement.Sid === putSid) {
              putStatement = statement;
            }
          });

          // Update statement and policy
          // NOTE: The S3 API *should* remove duplicate principals, if any
          listStatement.Principal.AWS = updateAwsPrincipals(listStatement.Principal.AWS, workspaceRoleArn);
          getStatement.Principal.AWS = updateAwsPrincipals(getStatement.Principal.AWS, workspaceRoleArn);
          putStatement.Principal.AWS = updateAwsPrincipals(putStatement.Principal.AWS, workspaceRoleArn);

          s3Policy.Statement = s3Policy.Statement.filter(
            statement => ![listSid, getSid, putSid].includes(statement.Sid),
          );
          [listStatement, getStatement, putStatement].forEach(statement => {
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

  /**
   * Function that calculates which users need should and should not have access permissions for the given studyId
   * Accordingly calls methods that ensure/remove/update permissions for said users
   *
   * @param {String} studyId
   * @param {Object} updateRequest - permission add/remove/update requests coming from SWB UI
   */
  async applyWorkspacePermissions(studyId, updateRequest) {
    const allowedUsers = this._getAllowedUsers(updateRequest);
    const disAllowedUsers = this._getDisAllowedUsers(updateRequest);
    const permissionChangeUsers = this._getPermissionChangeUsers(updateRequest);

    if (_.isEmpty(allowedUsers) && _.isEmpty(disAllowedUsers) && _.isEmpty(permissionChangeUsers)) {
      return;
    }

    const total = _.size(allowedUsers) + _.size(disAllowedUsers) + _.size(permissionChangeUsers);
    const limit = 200;
    if (total > limit) {
      this.boom.internalError(
        `This requires system to update ${total} workspace permissions at a time. Please reduce this to within ${limit} workspaces owned by selected users`,
      );
    }

    const errors = [];
    const runAndCaptureErrors = async (users, fn) => {
      if (_.isEmpty(users)) return;
      try {
        await fn(users);
      } catch (error) {
        if (_.isArray(error)) {
          errors.push(...error);
        } else {
          errors.push(error);
        }
      }
    };

    await runAndCaptureErrors(allowedUsers, users => this.addPermissions(users, studyId, updateRequest));
    await runAndCaptureErrors(disAllowedUsers, users => this.removePermissions(users, studyId, updateRequest));
    await runAndCaptureErrors(permissionChangeUsers, users => this.updatePermissions(users, studyId, updateRequest));

    if (!_.isEmpty(errors)) {
      const count = _.size(errors);
      throw this.boom.internalError(`Could not update permissions for ${count} workspaces`, true).withPayload(
        {
          errors,
        },
        true,
      );
    }
  }

  /**
   * This method will add/ensure ReadOnly or Read/Write access for workspaces owned by users in the given list
   * only if these workspaces have this study mounted on it during provision time.
   * This will not mount studies on user-owned workspaces which did not have them
   *
   * @param {Object[]} allowedUsers - Users that newly/continue-to have access to given studyId
   * @param {String} studyId
   */
  async addPermissions(allowedUsers, studyId, updateRequest) {
    const [iamService, environmentScService] = await this.service(['iamService', 'environmentScService']);
    const errors = [];
    await Promise.all(
      _.map(allowedUsers, async user => {
        const isStudyAdmin = _.includes(
          updateRequest.usersToAdd,
          u => u.permissionLevel === 'admin' && u.uid === user.uid,
        );
        const userOwnedEnvs = await environmentScService.getActiveEnvsForUser(user.uid);
        const envsWithStudy = _.filter(userOwnedEnvs, env => _.includes(env.studyIds, studyId));
        await Promise.all(
          _.map(envsWithStudy, async env => {
            try {
              const {
                iamClient,
                studyPathArn,
                policyDoc,
                roleName,
                studyDataPolicyName,
              } = await this._getIamUpdateParams(env, studyId);

              const statementSidToUse = this._getStatementSidToUse(user.permissionLevel);
              policyDoc.Statement = this._getStatementsAfterAddition(policyDoc, studyPathArn, statementSidToUse);
              policyDoc.Statement = this._ensureListAccess(policyDoc, studyPathArn);
              if (isStudyAdmin && user.permissionLevel === 'readwrite') {
                policyDoc.Statement = this._ensureDistinctAccess(policyDoc, studyPathArn);
              }
              await iamService.putRolePolicy(roleName, studyDataPolicyName, JSON.stringify(policyDoc), iamClient);
            } catch (error) {
              const envId = env.id;
              errors.push({ envId, reason: error.message || 'Unknown error' });
            }
          }),
        );
      }),
    );
    if (!_.isEmpty(errors)) {
      throw errors;
    }
  }

  /**
   * This method will remove the ReadOnly or Read/Write access for workspaces owned by users in the given list
   * only if these workspaces have this study mounted on it during provision time.
   * This will not unmount studies from user-owned workspaces, and therefore could be re-assigned access later
   *
   * @param {Object[]} disAllowedUsers - Users that lost access to given studyId
   * @param {String} studyId
   */
  async removePermissions(disAllowedUsers, studyId, updateRequest) {
    const [iamService, environmentScService] = await this.service(['iamService', 'environmentScService']);
    const errors = [];
    await Promise.all(
      _.map(disAllowedUsers, async user => {
        const isStudyAdmin = _.includes(
          updateRequest.usersToAdd,
          u => u.permissionLevel === 'admin' && u.uid === user.uid,
        );
        const userOwnedEnvs = await environmentScService.getActiveEnvsForUser(user.uid);
        const envsWithStudy = _.filter(userOwnedEnvs, env => _.includes(env.studyIds, studyId));
        await Promise.all(
          _.map(envsWithStudy, async env => {
            try {
              const {
                iamClient,
                studyPathArn,
                policyDoc,
                roleName,
                studyDataPolicyName,
              } = await this._getIamUpdateParams(env, studyId);

              const statementSidToUse = this._getStatementSidToUse(user.permissionLevel);
              // Study admin should always have R/O access (for backwards compatibility)
              policyDoc.Statement = this._getStatementsAfterRemoval(policyDoc, studyPathArn, statementSidToUse);
              policyDoc.Statement = this._removeListAccess(policyDoc, studyPathArn);
              if (isStudyAdmin) {
                policyDoc.Statement = this._ensureReadAccess(policyDoc, studyPathArn);
              }
              await iamService.putRolePolicy(roleName, studyDataPolicyName, JSON.stringify(policyDoc), iamClient);
            } catch (error) {
              const envId = env.id;
              errors.push({ envId, reason: error.message || 'Unknown error' });
            }
          }),
        );
      }),
    );
    if (!_.isEmpty(errors)) {
      throw errors;
    }
  }

  /**
   * This method will assign a different permission level than earlier for workspaces owned by users in the given list
   * only if these workspaces have this study mounted on it during provision time.
   *
   * @param {Object[]} permissionChangeUsers - Users reassigned with different access level for the given studyId
   * @param {String} studyId
   * @param {Object} updateRequest - permission add/remove/update requests coming from SWB UI
   */
  async updatePermissions(permissionChangeUsers, studyId, updateRequest) {
    const [iamService, environmentScService] = await this.service(['iamService', 'environmentScService']);
    const errors = [];
    const userUids = _.uniq(_.map(permissionChangeUsers, user => user.uid));
    await Promise.all(
      _.map(userUids, async userUid => {
        const removeUserPermission = _.find(
          updateRequest.usersToRemove,
          user => user.uid === userUid && user.permissionLevel !== 'admin',
        ).permissionLevel;
        const addUserPermission = _.find(
          updateRequest.usersToAdd,
          user => user.uid === userUid && user.permissionLevel !== 'admin',
        ).permissionLevel;

        const userOwnedEnvs = await environmentScService.getActiveEnvsForUser(userUid);
        const envsWithStudy = _.filter(userOwnedEnvs, env => _.includes(env.studyIds, studyId));

        await Promise.all(
          _.map(envsWithStudy, async env => {
            try {
              const {
                iamClient,
                studyPathArn,
                policyDoc,
                roleName,
                studyDataPolicyName,
              } = await this._getIamUpdateParams(env, studyId);

              const removePermissionsSid = this._getStatementSidToUse(removeUserPermission);
              const addPermissionsSid = this._getStatementSidToUse(addUserPermission);
              policyDoc.Statement = this._getStatementsAfterRemoval(policyDoc, studyPathArn, removePermissionsSid);
              policyDoc.Statement = this._getStatementsAfterAddition(policyDoc, studyPathArn, addPermissionsSid);
              await iamService.putRolePolicy(roleName, studyDataPolicyName, JSON.stringify(policyDoc), iamClient);
              // No need to manage list access for updates, that is only for add/update permissions
            } catch (error) {
              const envId = env.id;
              errors.push({ envId, reason: error.message || 'Unknown error' });
            }
          }),
        );
      }),
    );
    if (!_.isEmpty(errors)) {
      throw errors;
    }
  }

  /**
   * Function that returns updated policy document after making sure study admin
   * has access to only one of the permission level access
   *
   * @param {Object} policyDoc - S3 studydata policy document for workspace role
   * @param {String} studyPathArn
   * @returns {Object[]} - the statement to update in the policy
   */
  _ensureDistinctAccess(policyDoc, studyPathArn) {
    const readOnlyStatementSid = 'S3StudyReadOnlyAccess';
    policyDoc.Statement = this._ensureListAccess(policyDoc, studyPathArn);
    policyDoc.Statement = this._getStatementsAfterRemoval(policyDoc, studyPathArn, readOnlyStatementSid);
    return policyDoc.Statement;
  }

  /**
   * Function that returns updated policy document after making sure study admin at least continues to have R/O access
   *
   * @param {Object} policyDoc - S3 studydata policy document for workspace role
   * @param {String} studyPathArn
   * @returns {Object[]} - the statement to update in the policy
   */
  _ensureReadAccess(policyDoc, studyPathArn) {
    const readOnlyStatementSid = 'S3StudyReadOnlyAccess';
    policyDoc.Statement = this._ensureListAccess(policyDoc, studyPathArn);
    policyDoc.Statement = this._getStatementsAfterAddition(policyDoc, studyPathArn, readOnlyStatementSid);
    return policyDoc.Statement;
  }

  /**
   * Function that returns updated policy document with additions according to recent user-study permission change
   *
   * @param {Object} policyDoc - S3 studydata policy document for workspace role
   * @param {String} studyPathArn
   * @returns {Object[]} - the statement to update in the policy
   */
  _getStatementsAfterAddition(policyDoc, studyPathArn, statementSidToUse) {
    if (
      !_.includes(
        _.map(policyDoc.Statement, s => s.Sid),
        statementSidToUse,
      )
    ) {
      // If the statement didn't exist for this policy, add it now
      policyDoc.Statement.push(this._getStatementObject(statementSidToUse, studyPathArn));
    } else {
      // Change permission statements for this study in policy doc
      _.forEach(policyDoc.Statement, statement => {
        // Check if study ARN already exists in the specific statement's resources
        if (statement.Sid === statementSidToUse && !_.includes(statement.Resource, studyPathArn)) {
          statement.Resource.push(studyPathArn);
        }
      });
    }
    return policyDoc.Statement;
  }

  /**
   * Function that returns updated policy document with removals according to recent user-study permission change
   *
   * @param {Object} policyDoc - S3 studydata policy document for workspace role
   * @param {String} studyPathArn
   * @returns {Object[]} - the statement to update in the policy
   */
  _getStatementsAfterRemoval(policyDoc, studyPathArn, statementSidToUse) {
    const selectedStatement = _.find(policyDoc.Statement, statement => statement.Sid === statementSidToUse);

    if (selectedStatement) {
      if (_.includes(selectedStatement.Resource, studyPathArn) && selectedStatement.Resource.length === 1) {
        // Handle scenarios where there is only one Resource in the list
        policyDoc.Statement = _.filter(policyDoc.Statement, statement => statement.Sid !== statementSidToUse);
      } else {
        // Change permission statements for this study in policy doc
        _.forEach(policyDoc.Statement, statement => {
          if (statement.Sid === statementSidToUse && _.includes(statement.Resource, studyPathArn)) {
            const index = statement.Resource.indexOf(studyPathArn);
            statement.Resource.splice(index, 1);
          }
        });
      }
    }
    return policyDoc.Statement;
  }

  /**
   * Function that returns a policy statement for the specific permission level
   * for scenarios where the policy does not have one already
   *
   * @param {String} statementSidToUse - the statement to update in the policy
   * @param {String} studyPathArn
   * @returns {Object} - Statement with correct permissions
   */
  _getStatementObject(statementSidToUse, studyPathArn) {
    return {
      Sid: statementSidToUse,
      Effect: 'Allow',
      Action:
        statementSidToUse === 'S3StudyReadWriteAccess'
          ? ['s3:GetObject', 's3:PutObject', 's3:PutObjectAcl']
          : ['s3:GetObject'],
      Resource: [studyPathArn],
    };
  }

  /**
   * This method will filter out existing/added users from the original updateRequest
   * for access to the study
   *
   * @param {Object} updateRequest - permission add/remove/update requests coming from SWB UI
   * @returns {Object[]} - List of users which newly/continue-to have access to the study
   */
  _getAllowedUsers(updateRequest) {
    return _.filter(
      updateRequest.usersToAdd,
      userToAdd =>
        !_.includes(
          _.map(
            _.filter(updateRequest.usersToRemove, u => u.permissionLevel !== 'admin'),
            userToRemove => userToRemove.uid,
          ),
          userToAdd.uid,
        ) && userToAdd.permissionLevel !== 'admin',
    );
  }

  /**
   * This method will filter out users from the original updateRequest
   * who lost access to the study
   *
   * @param {Object} updateRequest - permission add/remove/update requests coming from SWB UI
   * @returns {Object[]} - List of users which lost access to the study
   */
  _getDisAllowedUsers(updateRequest) {
    return _.filter(
      updateRequest.usersToRemove,
      userToRemove =>
        !_.includes(
          _.map(
            _.filter(updateRequest.usersToAdd, u => u.permissionLevel !== 'admin'),
            userToAdd => userToAdd.uid,
          ),
          userToRemove.uid,
        ) && userToRemove.permissionLevel !== 'admin',
    );
  }

  /**
   * This method will filter out users from the original updateRequest
   * who have switched permission levels for the study
   *
   * @param {Object} updateRequest - permission add/remove/update requests coming from SWB UI
   * @returns {Object[]} - List of users which have switched permission levels for the study
   */
  _getPermissionChangeUsers(updateRequest) {
    return _.filter(
      updateRequest.usersToRemove,
      userToRemove =>
        _.includes(
          _.map(
            _.filter(updateRequest.usersToAdd, u => u.permissionLevel !== 'admin'),
            userToAdd => userToAdd.uid,
          ),
          userToRemove.uid,
        ) && userToRemove.permissionLevel !== 'admin',
    );
  }

  /**
   * Function that returns updated policy document after ensuring workspace has list permissions for studies it has some access to
   *
   * @param {Object} policyDoc - S3 studydata policy document for workspace role
   * @param {String} studyPathArn
   * @returns {Object[]} - the statement to update in the policy
   */
  _ensureListAccess(policyDoc, studyPathArn) {
    const s3BucketName = studyPathArn.substring(0, studyPathArn.indexOf('/'));
    const studyPrefix = studyPathArn.substring(studyPathArn.indexOf('/') + 1);

    _.forEach(policyDoc.Statement, statement => {
      if (
        statement.Sid.startsWith('studyListS3Access') &&
        statement.Effect === 'Allow' &&
        statement.Resource === s3BucketName &&
        !_.includes(statement.Condition.StringLike['s3:prefix'], studyPrefix)
      ) {
        statement.Condition.StringLike['s3:prefix'].push(studyPrefix);
      }
    });

    return policyDoc.Statement;
  }

  /**
   * Function that returns updated policy document after removing workspace's list permissions for studies it has no access to
   *
   * @param {Object} policyDoc - S3 studydata policy document for workspace role
   * @param {String} studyPathArn
   * @returns {Object[]} - the statement to update in the policy
   */
  _removeListAccess(policyDoc, studyPathArn) {
    const s3BucketName = studyPathArn.substring(0, studyPathArn.indexOf('/'));
    const studyPrefix = studyPathArn.substring(studyPathArn.indexOf('/') + 1);

    _.forEach(policyDoc.Statement, statement => {
      if (
        statement.Sid.startsWith('studyListS3Access') &&
        statement.Effect === 'Allow' &&
        statement.Resource === s3BucketName &&
        _.includes(statement.Condition.StringLike['s3:prefix'], studyPrefix)
      ) {
        const index = statement.Condition.StringLike['s3:prefix'].indexOf(studyPrefix);
        statement.Condition.StringLike['s3:prefix'].splice(index, 1);
      }
    });

    return policyDoc.Statement;
  }

  async _getWorkspacePolicy(iamClient, env) {
    const iamService = await this.service('iamService');
    const workspaceRoleArn = _.find(env.outputs, { OutputKey: 'WorkspaceInstanceRoleArn' }).OutputValue;
    const roleName = workspaceRoleArn.split('role/')[1];
    const studyDataPolicyName = `analysis-${workspaceRoleArn.split('-')[1]}-s3-studydata-policy`;
    const { PolicyDocument: policyDocStr } = await iamService.getRolePolicy(roleName, studyDataPolicyName, iamClient);
    const policyDoc = JSON.parse(policyDocStr);
    return { policyDoc, roleName, studyDataPolicyName };
  }

  async _getIamUpdateParams(env, studyId) {
    const sysRequestContext = getSystemRequestContext();
    const iamClient = await this._getEnvIamClient(sysRequestContext, env);
    const { policyDoc, roleName, studyDataPolicyName } = await this._getWorkspacePolicy(iamClient, env);
    const studyPathArn = await this._getStudyArn(sysRequestContext, studyId);
    return { iamClient, studyPathArn, policyDoc, roleName, studyDataPolicyName };
  }

  async _getStudyArn(requestContext, studyId) {
    const studyService = await this.service('studyService');
    const studyInfo = [];
    const { id, name, category, resources } = await studyService.mustFind(requestContext, studyId);
    studyInfo.push({ id, name, category, resources });
    const studyPathArn = await this._getObjectPathArns(studyInfo);
    return studyPathArn[0];
  }

  _getStatementSidToUse(permissionLevel) {
    let statementSidToUse = '';
    if (permissionLevel === 'readwrite') {
      statementSidToUse = 'S3StudyReadWriteAccess';
    } else if (permissionLevel === 'readonly') {
      statementSidToUse = 'S3StudyReadAccess';
    }
    if (statementSidToUse === '') {
      throw new Error(
        `Currently only readonly and readwrite permissions can be updated. Permission changed: ${permissionLevel}`,
      );
    }
    return statementSidToUse;
  }

  async _getEnvIamClient(requestContext, env) {
    const [environmentScService, aws] = await this.service(['environmentScService', 'aws']);
    const { cfnExecutionRoleArn, roleExternalId } = await environmentScService.getCfnExecutionRoleArn(
      requestContext,
      env,
    );

    const iamClient = await aws.getClientSdkForRole({
      roleArn: cfnExecutionRoleArn,
      externalId: roleExternalId,
      clientName: 'IAM',
    });

    return iamClient;
  }

  async _getStudyInfo(requestContext, studyIds) {
    let studyInfo = [];
    if (studyIds && studyIds.length) {
      const [studyService, studyPermissionService] = await this.service(['studyService', 'studyPermissionService']);

      studyInfo = await Promise.all(
        _.map(studyIds, async studyId => {
          try {
            const { id, name, category, resources } = await studyService.mustFind(requestContext, studyId);

            // Find out if the current user has Read/Write access
            const uid = _.get(requestContext, 'principalIdentifier.uid');
            const studyPermission = await studyPermissionService.findByUser(requestContext, uid);
            const writeable = _.includes(studyPermission.readwriteAccess, studyId) || category === 'My Studies';
            return { id, name, category, resources, writeable };
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

      // If there are no stored permissions, use an empty permissions object
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

  _getObjectPathArns(studyInfo) {
    // Collect study resources
    const objectPathArns = _.flatten(
      _.map(studyInfo, info =>
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
    return objectPathArns;
  }

  async _generateIamPolicyDoc(studyInfo) {
    let policyDoc = {};
    // Build policy statements for object-level permissions
    const statements = [];

    if (studyInfo.length) {
      const writeableStudies = _.filter(studyInfo, study => study.writeable);
      const readonlyStudies = _.filter(studyInfo, study => !study.writeable);

      if (writeableStudies.length) {
        const objectLevelWriteActions = ['s3:GetObject', 's3:PutObject', 's3:PutObjectAcl'];
        statements.push({
          Sid: 'S3StudyReadWriteAccess',
          Effect: 'Allow',
          Action: objectLevelWriteActions,
          Resource: this._getObjectPathArns(writeableStudies),
        });
      }

      if (readonlyStudies.length) {
        const objectLevelReadActions = ['s3:GetObject'];
        statements.push({
          Sid: 'S3StudyReadAccess',
          Effect: 'Allow',
          Action: objectLevelReadActions,
          Resource: this._getObjectPathArns(readonlyStudies),
        });
      }

      // Create map of buckets whose paths need list access
      const bucketPaths = {};
      this._getObjectPathArns(studyInfo).forEach(arn => {
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
