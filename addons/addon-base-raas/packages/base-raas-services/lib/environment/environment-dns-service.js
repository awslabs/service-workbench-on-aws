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

const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  domainName: 'domainName',
  hostedZoneId: 'hostedZoneId',
};

class EnvironmentDnsService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'environmentScService']);
  }

  getHostname(prefix, id) {
    const domainName = this.settings.get(settingKeys.domainName);
    return `${prefix}-${id}.${domainName}`;
  }

  async changePrivateRecordSet(requestContext, action, prefix, id, privateIp, hostedZoneId) {
    const environmentScService = await this.service('environmentScService');
    const route53Client = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id },
      { clientName: 'Route53', options: { apiVersion: '2017-07-24' } },
    );
    const subdomain = this.getHostname(prefix, id);
    await this.changeResourceRecordSets(route53Client, hostedZoneId, action, subdomain, 'A', privateIp);
  }

  async changeRecordSet(action, prefix, id, publicDnsName) {
    const aws = await this.service('aws');
    const route53Client = new aws.sdk.Route53();
    const hostedZoneId = this.settings.get(settingKeys.hostedZoneId);
    const subdomain = this.getHostname(prefix, id);
    await this.changeResourceRecordSets(route53Client, hostedZoneId, action, subdomain, 'CNAME', publicDnsName);
  }

  async changeResourceRecordSets(route53Client, hostedZoneId, action, subdomain, recordType, recordValue) {
    const params = {
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: {
              Name: subdomain,
              Type: recordType,
              TTL: 300,
              ResourceRecords: [{ Value: recordValue }],
            },
          },
        ],
      },
    };
    await route53Client.changeResourceRecordSets(params).promise();
  }

  async createPrivateRecord(requestContext, prefix, id, privateIp, hostedZoneId) {
    await this.changePrivateRecordSet(requestContext, 'CREATE', prefix, id, privateIp, hostedZoneId);
  }

  async deletePrivateRecord(requestContext, prefix, id, privateIp, hostedZoneId) {
    await this.changePrivateRecordSet(requestContext, 'DELETE', prefix, id, privateIp, hostedZoneId);
  }

  async createRecord(prefix, id, publicDnsName) {
    await this.changeRecordSet('CREATE', prefix, id, publicDnsName);
  }

  async deleteRecord(prefix, id, publicDnsName) {
    await this.changeRecordSet('DELETE', prefix, id, publicDnsName);
  }
}

module.exports = EnvironmentDnsService;
