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

describe('Subnets', () => {
  beforeAll(async () => {
    await setupAws();
  });

  it('should have no internet gateways', async () => {
    const cloudformation = new AWS.CloudFormation();
    const ec2 = new AWS.EC2();

    // Look at resources created by CF Stack
    const stackResources = await cloudformation
      .describeStackResources({
        StackName: hostingAccountStackName,
      })
      .promise();

    // Grab Route tables created for AppStream VPC
    const vpcId = stackResources.StackResources.find(resource => {
      return resource.LogicalResourceId === 'VPC';
    }).PhysicalResourceId;
    const routeTablesForDefaultVpcResponse = await ec2
      .describeRouteTables({
        Filters: [
          {
            Name: 'vpc-id',
            Values: [vpcId],
          },
        ],
      })
      .promise();

    // Get Route Table created for Private Workspace subnet
    const workspaceRouteTableId = stackResources.StackResources.find(resource => {
      return resource.LogicalResourceId === 'PrivateWorkspaceRouteTable';
    }).PhysicalResourceId;
    const workspaceRouteTableResponse = await ec2
      .describeRouteTables({
        Filters: [
          {
            Name: 'route-table-id',
            Values: [workspaceRouteTableId],
          },
        ],
      })
      .promise();
    expect(workspaceRouteTableResponse.RouteTables.length).toEqual(1);
    const workspaceRouteTable = workspaceRouteTableResponse.RouteTables[0];

    // Check no route tables points to an Internet Gateway
    checkRouteTableDoesNotHaveIGW(routeTablesForDefaultVpcResponse.RouteTables);
    checkRouteTableDoesNotHaveIGW([workspaceRouteTable]);
  });

  function checkRouteTableDoesNotHaveIGW(routeTables) {
    let gatewayIds = [];
    routeTables.forEach(rtb => {
      const ids = rtb.Routes.map(route => {
        return route.GatewayId;
      });
      gatewayIds = [...gatewayIds, ...ids];
    });

    expect(
      gatewayIds.some(gatewayId => {
        // Check whether route table points to any Internet Gateways
        return gatewayId.includes('igw-');
      }),
    ).toEqual(false);
  }
});
