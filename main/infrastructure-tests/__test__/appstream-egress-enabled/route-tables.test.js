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
const { getCFStackResources, getStackResourcesByType } = require('../../support/utilities');

describe('Route tables', () => {
  beforeAll(async () => {
    await setupAws();
  });

  it('should not point to any internet gateways', async () => {
    const stackResources = await getCFStackResources();
    const ec2 = new AWS.EC2();

    // Grab Route tables created for AppStream VPC
    const vpcId = await getStackResourcesByType('VPC', stackResources);
    const routeTablesForAppStreamVpcResponse = await ec2
      .describeRouteTables({
        Filters: [
          {
            Name: 'vpc-id',
            Values: vpcId,
          },
        ],
      })
      .promise();

    // Get Route Tables created by the stack
    const routeTableIds = await getStackResourcesByType('AWS::EC2::RouteTable', stackResources);
    const workspaceRouteTableResponse = await ec2
      .describeRouteTables({
        Filters: [
          {
            Name: 'route-table-id',
            Values: routeTableIds,
          },
        ],
      })
      .promise();

    // Check that no route tables point to an Internet Gateway
    checkRouteTableDoesNotHaveIGW(routeTablesForAppStreamVpcResponse.RouteTables);
    checkRouteTableDoesNotHaveIGW(workspaceRouteTableResponse.RouteTables);
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
