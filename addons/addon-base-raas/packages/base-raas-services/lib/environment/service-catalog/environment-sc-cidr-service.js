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
const IsCidr = require('is-cidr');
const Service = require('@aws-ee/base-services-container/lib/service');

const cidrUpdateSchema = require('../../schema/update-environment-sc-cidr');

class EnvironmentScCidrService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'environmentScService',
      'environmentAuthzService',
      'auditWriterService',
      'authorizationService',
      'jsonSchemaValidationService',
      'lockService',
    ]);
  }

  async init() {
    await super.init();
    const environmentAuthzService = await this.service('environmentAuthzService');
    // A private authorization condition function that just delegates to the environmentAuthzService
    this._allowAuthorized = (requestContext, { resource, action, effect, reason }, ...args) =>
      environmentAuthzService.authorize(requestContext, { resource, action, effect, reason }, ...args);
  }

  checkRequest(updateRequest) {
    const erroneousInputs = [];
    const ipv6Format = [];
    const protPortCombos = {};
    _.map(updateRequest, rule => {
      _.forEach(rule.cidrBlocks, cidrBlock => {
        if (IsCidr(cidrBlock) === 0) erroneousInputs.push(cidrBlock);
        if (IsCidr.v6(cidrBlock)) ipv6Format.push(cidrBlock);
      });
      const protPort = `${rule.protocol}-${rule.fromPort}-${rule.toPort}`;
      if (_.get(protPortCombos, protPort))
        throw this.boom.badRequest(
          'The update request contains duplicate protocol-port combinations. Please make sure all ingress rule objects have unique protocol-fromPort-toPort combinations',
          true,
        );
      protPortCombos[protPort] = true;
    });

    if (!_.isEmpty(erroneousInputs))
      throw this.boom.badRequest(`The following are invalid CIDR inputs: ${erroneousInputs.join(', ')}`, true);

    if (!_.isEmpty(ipv6Format))
      throw this.boom.badRequest(
        `Currently only IPv4 formatted CIDR inputs are allowed. Please remove: ${ipv6Format.join(
          ', ',
        )} CIDR ranges from your list`,
        true,
      );
  }

  /**
   * Method checks the existing Ingress Rules are on the workspace's security group
   * and accordingly calls another methods that take care of calculating CIDR blocks for revoking and authorizing
   * and finally sends the updated environmentSc object with the cidr field to the UI store
   *
   * @param requestContext
   * @param id Id of the AWS Service Catalog based environment
   * @param updateRequest List of protocol-port combinations along with the CIDR blocks for each of them
   * @returns {Promise<*>} ScEnvironment entity object with updated cidr
   */
  async update(requestContext, { id, updateRequest }) {
    const [environmentScService, lockService, validationService] = await this.service([
      'environmentScService',
      'lockService',
      'jsonSchemaValidationService',
    ]);

    // Validate input
    await validationService.ensureValid(updateRequest, cidrUpdateSchema);
    this.checkRequest(updateRequest);

    const existingEnvironment = await environmentScService.mustFind(requestContext, { id });

    // Check if user is allowed to update cidrs
    await this.assertAuthorized(
      requestContext,
      { action: 'update-sc', conditions: [this._allowAuthorized] },
      { ...existingEnvironment, updateRequest },
    );

    await lockService.tryWriteLockAndRun({ id: `${id}-CidrUpdate` }, async () => {
      // Calculate diff and update CIDR ranges in ingress rules
      const { currentIngressRules, securityGroupId } = await environmentScService.getSecurityGroupDetails(
        requestContext,
        existingEnvironment,
      );

      if (_.isEmpty(currentIngressRules))
        throw this.boom.badRequest(
          'The Security Group for this workspace does not contain any ingress rules configured in the Service Catalog product template',
          true,
        );

      // Perform the actual security group ingress rule updates
      const newCidrList = await this.getUpdatedIngressRules(requestContext, {
        existingEnvironment,
        securityGroupId,
        currentIngressRules,
        updateRequest,
      });

      // Not storing the changes in the DB, but since all went well
      // we return the cidr field as part of the env obj
      existingEnvironment.cidr = newCidrList;
    });

    // Write audit event
    await this.audit(requestContext, { action: 'update-environment-sc-cidr', body: existingEnvironment });

    return existingEnvironment;
  }

  // This method is responsible for generating the IpPermissions object
  // that is included in the revoke/authorize call params
  getIpPermission(updateRule, cidrList) {
    const ipv4List = _.filter(cidrList, cidr => IsCidr.v4(cidr));
    const IpPermission = {
      FromPort: updateRule.fromPort,
      IpProtocol: updateRule.protocol,
      IpRanges: _.map(ipv4List, cidr => ({
        CidrIp: cidr,
        // For future: Custom description doesn't work, since that has to match exactly what's there in the SG.
        // This would require sending one CIDR block per IpPermission object
        // Description: `Updated via SWB`,
      })),
      // Future: Ipv6 calls have to be done separately and cannot be part of IpPermission object that contains IpRanges (Ipv4)
      // Ipv6Ranges: _.map(ipv6List, cidr => ({
      //   CidrIp: cidr,
      //   Description: `Updated via SWB`,
      // })),
      ToPort: updateRule.toPort,
    };
    return IpPermission;
  }

  // This method is smart enough to determine which IPs to revoke/grant access
  // by peeking into the ingress rules of the workspace's security group
  async getUpdatedIngressRules(
    requestContext,
    { existingEnvironment, securityGroupId, currentIngressRules, updateRequest } = {},
  ) {
    const addIpPermissions = [];
    const revokeIpPermissions = [];

    // This helps us keep track of how many protocol-port combinations
    // matched between the SG and the update request
    const newCidrList = [];

    _.forEach(currentIngressRules, existingRule => {
      const matchingRule = _.find(updateRequest, {
        fromPort: existingRule.fromPort,
        toPort: existingRule.toPort,
        protocol: existingRule.protocol,
      });
      if (matchingRule) {
        const addCidrs = _.difference(matchingRule.cidrBlocks, existingRule.cidrBlocks);
        const revokeCidrs = _.difference(existingRule.cidrBlocks, matchingRule.cidrBlocks);

        if (!_.isEmpty(addCidrs)) addIpPermissions.push(this.getIpPermission(matchingRule, addCidrs));
        if (!_.isEmpty(revokeCidrs)) revokeIpPermissions.push(this.getIpPermission(matchingRule, revokeCidrs));
        newCidrList.push(matchingRule);
      }
    });

    if (_.isEmpty(newCidrList))
      throw this.boom.badRequest(
        'Please use only the protocol-port combinations configured via Service Catalog for CIDR updates',
        true,
      );

    // Get params ready
    const revokeParams = { GroupId: securityGroupId, IpPermissions: revokeIpPermissions };
    const authorizeParams = { GroupId: securityGroupId, IpPermissions: addIpPermissions };

    // Start making security group updates
    const ec2Client = await this.getEc2Client(requestContext, existingEnvironment.id);
    if (!_.isEmpty(revokeIpPermissions)) await this.revokeSecurityGroupIngress(ec2Client, revokeParams);
    if (!_.isEmpty(addIpPermissions)) await this.authorizeSecurityGroupIngress(ec2Client, authorizeParams);

    return newCidrList;
  }

  async revokeSecurityGroupIngress(ec2Client, revokeParams) {
    await ec2Client.revokeSecurityGroupIngress(revokeParams).promise();
  }

  async authorizeSecurityGroupIngress(ec2Client, authorizeParams) {
    await ec2Client.authorizeSecurityGroupIngress(authorizeParams).promise();
  }

  async getEc2Client(requestContext, envId) {
    const environmentScService = await this.service('environmentScService');
    const ec2Client = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: envId },
      { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
    );
    return ec2Client;
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'environment-authz', action, conditions },
      ...args,
    );
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = EnvironmentScCidrService;
