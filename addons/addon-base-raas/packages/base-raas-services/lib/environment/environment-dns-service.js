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
    this.dependency(['aws']);
  }

  getHostname(prefix, id) {
    const domainName = this.settings.get(settingKeys.domainName);
    return `${prefix}-${id}.${domainName}`;
  }

  async changeRecordSet(action, prefix, id, publicDnsName) {
    const aws = await this.service('aws');
    const route53Client = new aws.sdk.Route53();
    const hostedZoneId = this.settings.get(settingKeys.hostedZoneId);
    const subdomain = this.getHostname(prefix, id);
    const params = {
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: {
              Name: subdomain,
              Type: 'CNAME',
              TTL: 300,
              ResourceRecords: [{ Value: publicDnsName }],
            },
          },
        ],
      },
    };
    await route53Client.changeResourceRecordSets(params).promise();
  }

  async createRecord(prefix, id, publicDnsName) {
    await this.changeRecordSet('CREATE', prefix, id, publicDnsName);
  }

  async deleteRecord(prefix, id, publicDnsName) {
    await this.changeRecordSet('DELETE', prefix, id, publicDnsName);
  }
}

module.exports = EnvironmentDnsService;
