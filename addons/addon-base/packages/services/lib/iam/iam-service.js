const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { paginatedList, processSequentially } = require('../helpers/utils');

const emptyObjectIfDoesNotExist = e => {
  if (e.code === 'NoSuchEntity' || e.code === 'ResourceNotFoundException') {
    return {}; // return empty object if the entity does not exists
  }
  throw e; // for any other error let it bubble up
};

class IamService extends Service {
  constructor() {
    super();
    this.dependency('aws');
  }

  async init() {
    await super.init();
    const aws = await this.service('aws');
    /** @type {AWS.IAM} */
    this.api = new aws.sdk.IAM({ apiVersion: '2014-11-06' });
  }

  /**
   * @param {string} roleName an IAM role name
   * @param iamClient Optional AWS SDK IAM client instance initialized with appropriate credentials.
   * If no client is given then the method will use the SDK with credentials initialized by the
   * "aws" service.
   *
   * @returns {Promise<string[]>} a list of all inline policy names
   */
  async listAllInlineRolePolicies(roleName, iamClient) {
    const listNextPage = async nextToken => {
      const iamSdk = iamClient || this.api;
      const result = await iamSdk.listRolePolicies({ RoleName: roleName, Marker: nextToken }).promise();
      return {
        list: result.PolicyNames,
        nextPageToken: result.IsTruncated ? result.Marker : undefined,
      };
    };
    return paginatedList(listNextPage);
  }

  /**
   * @param {string} roleName an IAM role name
   * @param iamClient Optional AWS SDK IAM client instance initialized with appropriate credentials.
   * If no client is given then the method will use the SDK with credentials initialized by the
   * "aws" service.
   * @param roleName
   * @param iamClient
   *
   * @returns {Promise<{PolicyArn: string, PolicyName: string}[]>} a list of all managed (attached) policies
   */
  async listAllManagedRolePolicies(roleName, iamClient) {
    const listNextPage = async nextToken => {
      const iamSdk = iamClient || this.api;
      const result = await iamSdk.listAttachedRolePolicies({ RoleName: roleName, Marker: nextToken }).promise();
      return {
        list: result.AttachedPolicies,
        nextPageToken: result.IsTruncated ? result.Marker : undefined,
      };
    };
    return paginatedList(listNextPage);
  }

  async listAllPolicyVersions(policyArn, iamClient) {
    const listNextPage = async nextToken => {
      const iamSdk = iamClient || this.api;
      const result = await iamSdk.listPolicyVersions({ PolicyArn: policyArn, Marker: nextToken }).promise();
      return {
        list: result.Versions,
        nextPageToken: result.IsTruncated ? result.Marker : undefined,
      };
    };
    return paginatedList(listNextPage);
  }

  async deletePolicy(policyArn, iamClient) {
    await this.deleteNonDefaultPolicyVersions(policyArn, iamClient);
    const iamSdk = iamClient || this.api;
    return iamSdk.deletePolicy({ PolicyArn: policyArn }).promise();
  }

  async deleteNonDefaultPolicyVersions(policyArn, iamClient) {
    const versions = await this.listAllPolicyVersions(policyArn, iamClient);
    const versionIds = _.map(_.filter(versions, { IsDefaultVersion: false }), 'VersionId');
    await processSequentially(versionIds, async versionId => this.deletePolicyVersion(policyArn, versionId, iamClient));
  }

  async deletePolicyVersion(policyArn, versionId, iamClient) {
    const iamSdk = iamClient || this.api;
    return iamSdk.deletePolicyVersion({ PolicyArn: policyArn, VersionId: versionId }).promise();
  }

  async createPolicyVersion(policyArn, policyDocument, setAsDefault, iamClient) {
    const policyDocumentStr = _.isObject(policyDocument) ? JSON.stringify(policyDocument) : policyDocument;

    // Delete older policy version (there's a limit of 5 versions per policy)
    await this.deleteOldestPolicyVersionIfNeeded(policyArn, iamClient);

    const iamSdk = iamClient || this.api;
    // Create new policy version
    return iamSdk
      .createPolicyVersion({ PolicyArn: policyArn, PolicyDocument: policyDocumentStr, SetAsDefault: setAsDefault })
      .promise();
  }

  async deleteOldestPolicyVersionIfNeeded(policyArn, iamClient) {
    // Delete older policy version (there's a limit of 5 versions per policy)
    const versions = await this.listAllPolicyVersions(policyArn, iamClient);
    if (versions.length >= 5) {
      const versionId = _.min(_.map(_.filter(versions, { IsDefaultVersion: false }), 'VersionId'));
      await this.deletePolicyVersion(policyArn, versionId, iamClient);
    }
  }

  async getRoleInfo(roleName, iamClient) {
    const iamSdk = iamClient || this.api;
    const { Role: role } = await iamSdk
      .getRole({ RoleName: roleName })
      .promise()
      .catch(emptyObjectIfDoesNotExist);
    if (role) {
      // The "AssumeRolePolicyDocument" is URL encoded JSON string
      const assumeRolePolicyDocument = decodeURIComponent(role.AssumeRolePolicyDocument);
      const trustPolicy = JSON.parse(assumeRolePolicyDocument);
      role.AssumeRolePolicyDocument = assumeRolePolicyDocument;
      role.AssumeRolePolicyDocumentObj = trustPolicy;
    }
    return { Role: role };
  }

  async getRolePolicy(roleName, policyName, iamClient) {
    const iamSdk = iamClient || this.api;
    const { PolicyDocument: policyDocument } = await iamSdk
      .getRolePolicy({ RoleName: roleName, PolicyName: policyName })
      .promise()
      .catch(emptyObjectIfDoesNotExist);

    const policy = { PolicyName: policyName };
    if (policyDocument) {
      // The "PolicyDocument" is URL encoded JSON string
      const policyDocumentSrc = decodeURIComponent(policyDocument);
      policy.PolicyDocument = policyDocumentSrc;
      policy.PolicyDocumentObj = JSON.parse(policyDocumentSrc);
    }
    return policy;
  }

  async putRolePolicy(roleName, policyName, policyDoc, iamClient) {
    const iamSdk = iamClient || this.api;
    await iamSdk
      .putRolePolicy({
        RoleName: roleName,
        PolicyName: policyName,
        PolicyDocument: policyDoc,
      })
      .promise();
  }

  async deleteRolePolicy(roleName, policyName, iamClient) {
    const iamSdk = iamClient || this.api;
    await iamSdk
      .deleteRolePolicy({
        RoleName: roleName,
        PolicyName: policyName,
      })
      .promise();
  }

  async getPolicyVersion(policyArn, versionId, iamClient) {
    const iamSdk = iamClient || this.api;
    const { PolicyVersion: policyVersionInfo } = await iamSdk
      .getPolicyVersion({ PolicyArn: policyArn, VersionId: versionId })
      .promise()
      .catch(emptyObjectIfDoesNotExist);

    if (policyVersionInfo) {
      // The "Document" is URL encoded JSON string
      const documentStr = decodeURIComponent(policyVersionInfo.Document);
      policyVersionInfo.Document = documentStr;
      policyVersionInfo.DocumentObj = JSON.parse(documentStr);
    }
    return { PolicyVersion: policyVersionInfo };
  }

  /**
   * Clones the role specified by the roleName from the source account to target account with the same role
   * name and permissions
   *
   * LIMITATION: This method does not clone permissions boundary
   *
   * @param roleName Name of the role to be cloned
   * @param iamClientForSrcAcc The IAM SDK client instance initialized with credentials for the source account where the role exists
   * @param iamClientForTargetAcc The IAM SDK client instance initialized with credentials for the target account where the role needs to be created
   * @returns {Promise<*>}
   */
  async cloneRole(roleName, iamClientForSrcAcc, iamClientForTargetAcc) {
    // Read source role
    const { Role: srcRole } = await this.getRoleInfo(roleName, iamClientForSrcAcc);

    // Make sure the role to be cloned exists
    if (!srcRole) {
      throw new Error(`Cannot clone "${roleName}" role. The role does not exist in the source account.`);
    }

    // Make sure the role does not have PermissionsBoundary set.
    // Not supporting cloning with PermissionsBoundary yet.
    if (!_.isEmpty(srcRole.PermissionsBoundary)) {
      throw new Error(
        `Cannot clone "${roleName}" role. Cloning of roles with PermissionsBoundary is not supported yet.`,
      );
    }

    // Read target role
    let { Role: targetRole } = await this.getRoleInfo(roleName, iamClientForTargetAcc);

    // Check if both roles are exactly same (i.e., in the same account)
    if (_.get(targetRole, 'Arn') === _.get(srcRole, 'Arn')) {
      // The source account and target account are same so there's nothing to do just return
      return { srcRole, targetRole };
    }

    if (targetRole) {
      // If the target role already exists and has different trust policy
      // (assume role policy) then update it to
      if (srcRole.AssumeRolePolicyDocument !== targetRole.AssumeRolePolicyDocument) {
        await iamClientForTargetAcc
          .updateAssumeRolePolicy({
            PolicyDocument: srcRole.AssumeRolePolicyDocument,
            RoleName: roleName,
          })
          .promise();
      }
      // If the target role exists and has different description then update it
      if (srcRole.Description !== targetRole.Description) {
        await iamClientForTargetAcc
          .updateRoleDescription({
            Description: srcRole.Description,
            RoleName: roleName,
          })
          .promise();
      }
    } else {
      // Create role in target account if it does not exist already
      const params = {
        RoleName: roleName,
        AssumeRolePolicyDocument: srcRole.AssumeRolePolicyDocument,
        Path: srcRole.Path,
        Description: srcRole.Description,
        MaxSessionDuration: srcRole.MaxSessionDuration,
        Tags: srcRole.Tags,
      };
      const { Role: createdTargetRole } = await iamClientForTargetAcc.createRole(params).promise();
      targetRole = createdTargetRole;
    }

    // Sync inline policies to the cloned role in target account
    await this.syncInlinePolicies(srcRole, targetRole, iamClientForSrcAcc, iamClientForTargetAcc);

    // Sync managed policies to the cloned role in target account
    await this.syncManagedPolicies(srcRole, targetRole, iamClientForSrcAcc, iamClientForTargetAcc);

    return { srcRole, targetRole };
  }

  async syncInlinePolicies(srcRole, targetRole, iamClientForSrcAcc, iamClientForTargetAcc) {
    const srcInlinePolicyNames = await this.listAllInlineRolePolicies(srcRole.RoleName, iamClientForSrcAcc);
    const targetInlinePolicyNames = await this.listAllInlineRolePolicies(targetRole.RoleName, iamClientForTargetAcc);

    const inTargetNotInSrc = _.differenceBy(targetInlinePolicyNames, srcInlinePolicyNames);

    // Create inline policy in the target role that are in the source role but not in target role
    await processSequentially(srcInlinePolicyNames, async policyName => {
      const { PolicyDocument: srcPolicyDocument } = await this.getRolePolicy(
        srcRole.RoleName,
        policyName,
        iamClientForSrcAcc,
      );
      const { PolicyDocument: targetPolicyDocument } = await this.getRolePolicy(
        targetRole.RoleName,
        policyName,
        iamClientForTargetAcc,
      );

      if (srcPolicyDocument !== targetPolicyDocument) {
        // The inline policy has changed in source account. Time to update it in target role as well.
        await iamClientForTargetAcc
          .putRolePolicy({
            RoleName: targetRole.RoleName,
            PolicyName: policyName,
            PolicyDocument: srcPolicyDocument,
          })
          .promise();
      }
    });

    // Delete inline policies from the target role that are not in the source role
    await processSequentially(inTargetNotInSrc, async policyName => {
      await iamClientForTargetAcc.deleteRolePolicy({ PolicyName: policyName, RoleName: targetRole.RoleName }).promise();
    });
  }

  async syncManagedPolicies(srcRole, targetRole, iamClientForSrcAcc, iamClientForTargetAcc) {
    const srcManagedPolicies = await this.listAllManagedRolePolicies(srcRole.RoleName, iamClientForSrcAcc);
    const targetManagedPolicies = await this.listAllManagedRolePolicies(targetRole.RoleName, iamClientForTargetAcc);

    // Handle AWS Managed policies first (all AWS managed policy arns have 'aws' in place of account number. E.g., "arn:aws:iam::aws:policy/AmazonEC2FullAccess")
    // Customer managed policies have account number in ARN, for example: arn:aws:iam::123456789012:policy/SomeCustomerManagedPolicyName
    const isAwsManagedPolicy = p => _.split(p.PolicyArn, ':')[4] === 'aws';

    const syncAwsManagedPolicies = async () => {
      const srcAwsManagedPolicies = _.filter(srcManagedPolicies, isAwsManagedPolicy);
      const targetAwsManagedPolicies = _.filter(targetManagedPolicies, isAwsManagedPolicy);

      const inSrcNotInTarget = _.differenceBy(srcAwsManagedPolicies, targetAwsManagedPolicies, 'PolicyArn');
      const inTargetNotInSrc = _.differenceBy(targetAwsManagedPolicies, srcAwsManagedPolicies, 'PolicyArn');

      // Attach the AWS managed policies to target role that are attached to the source role
      await processSequentially(inSrcNotInTarget, async policy => {
        await iamClientForTargetAcc
          .attachRolePolicy({ RoleName: targetRole.RoleName, PolicyArn: policy.PolicyArn })
          .promise();
      });

      // Detach the AWS managed policies in target role that are not in the source role
      await processSequentially(inTargetNotInSrc, async policy => {
        await iamClientForTargetAcc
          .detachRolePolicy({ RoleName: targetRole.RoleName, PolicyArn: policy.PolicyArn })
          .promise();
      });
    };

    const syncCustomerManagedPolicies = async () => {
      const srcCustomerManagedPolicies = _.filter(srcManagedPolicies, _.negate(isAwsManagedPolicy));
      const targetCustomerManagedPolicies = _.filter(targetManagedPolicies, _.negate(isAwsManagedPolicy));

      const inSrcNotInTarget = _.differenceBy(srcCustomerManagedPolicies, targetCustomerManagedPolicies, 'PolicyName');
      const inTargetNotInSrc = _.differenceBy(targetCustomerManagedPolicies, srcCustomerManagedPolicies, 'PolicyName');
      const inBoth = _.intersectionBy(srcCustomerManagedPolicies, targetCustomerManagedPolicies, 'PolicyName');

      // For all customer managed policies in source that's not in target,
      // create a customer managed policy in target account and then attach it to the target role
      await processSequentially(inSrcNotInTarget, async srcPolicy => {
        const { Policy: policyInfo } = await iamClientForSrcAcc.getPolicy({ PolicyArn: srcPolicy.PolicyArn }).promise();
        const { PolicyVersion: policyVersionInfo } = await this.getPolicyVersion(
          srcPolicy.PolicyArn,
          policyInfo.DefaultVersionId,
          iamClientForSrcAcc,
        );

        const { Policy: createdPolicy } = await iamClientForTargetAcc
          .createPolicy({
            PolicyName: policyInfo.PolicyName,
            Description: policyInfo.Description,
            Path: policyInfo.Path,
            PolicyDocument: policyVersionInfo.Document,
          })
          .promise();

        await iamClientForTargetAcc
          .attachRolePolicy({ RoleName: targetRole.RoleName, PolicyArn: createdPolicy.Arn })
          .promise();
      });

      // Detach all customer managed policies in target role that are no longer in source role,
      // Also delete them if they are not used anywhere else
      await processSequentially(inTargetNotInSrc, async targetPolicy => {
        await iamClientForTargetAcc
          .detachRolePolicy({ RoleName: targetRole.RoleName, PolicyArn: targetPolicy.PolicyArn })
          .promise();

        // If the policy is not used anywhere else then delete it
        const { Policy: policyInfo } = await iamClientForTargetAcc
          .getPolicy({ PolicyArn: targetPolicy.PolicyArn })
          .promise()
          .catch(emptyObjectIfDoesNotExist);
        if (policyInfo && policyInfo.AttachmentCount <= 0 && policyInfo.PermissionsBoundaryUsageCount <= 0) {
          await this.deletePolicy(targetPolicy.PolicyArn, iamClientForTargetAcc);
        }
      });

      // Sync policy documents for all policies that are already attached to target role with same names as the source role
      await processSequentially(inBoth, async srcPolicy => {
        const { Policy: policyInfo } = await iamClientForSrcAcc.getPolicy({ PolicyArn: srcPolicy.PolicyArn }).promise();
        const { PolicyVersion: policyVersionInfo } = await this.getPolicyVersion(
          srcPolicy.PolicyArn,
          policyInfo.DefaultVersionId,
          iamClientForSrcAcc,
        );

        // To update existing managed policy's document we need to create new policy version with the updated policy document
        await this.createPolicyVersion(srcPolicy.PolicyArn, policyVersionInfo.Document, true, iamClientForTargetAcc);
      });
    };

    await syncAwsManagedPolicies();
    await syncCustomerManagedPolicies();
  }
}
module.exports = IamService;
