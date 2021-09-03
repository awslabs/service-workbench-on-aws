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

const AWS = require('aws-sdk');
const setupAws = require('../../support/setupAws');

// eslint-disable-next-line no-undef
const { hostingAccountStackName } = __settings__;

describe('Security groups', () => {
  beforeAll(async () => {
    await setupAws();
  });

  it('should have least privilege', async () => {
    const cloudformation = new AWS.CloudFormation();
    const ec2 = new AWS.EC2();

    // Look at resources created by CF Stack
    const stackResources = await cloudformation
      .describeStackResources({
        StackName: hostingAccountStackName,
      })
      .promise();

    // Get all Security Group resources
    const sgIds = stackResources.StackResources.filter(resource => {
      return resource.ResourceType === 'AWS::EC2::SecurityGroup';
    }).map(sgResource => {
      return sgResource.PhysicalResourceId;
    });

    // Get details about each Security Group
    const securityGroupsResponse = await ec2
      .describeSecurityGroups({
        GroupIds: sgIds,
      })
      .promise();

    // Check Security Group inbound rules
    checkSGsDoesNotAllowInboundAccessFromEverywhere(securityGroupsResponse.SecurityGroups);
  });

  function checkSGsDoesNotAllowInboundAccessFromEverywhere(securityGroups) {
    const cidrIpsOfInboundRules = [];
    securityGroups.forEach(sg => {
      sg.IpPermissions.forEach(ipPermission => {
        ipPermission.IpRanges.forEach(ipRange => {
          cidrIpsOfInboundRules.push(ipRange.CidrIp);
        });
      });
    });

    console.log('cidrIpsOfInboundRules', cidrIpsOfInboundRules);

    // No inbound rule cidr should allow access from every IP address
    expect(
      cidrIpsOfInboundRules.filter(cidr => {
        return cidr === '0.0.0.0/0';
      }).length,
    ).toEqual(0);
  }
});
