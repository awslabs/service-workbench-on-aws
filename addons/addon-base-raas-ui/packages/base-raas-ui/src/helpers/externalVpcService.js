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

const EC2 = require('aws-sdk/clients/ec2');

export default class SageMakerService {
  constructor({ accessKeyId, secretAccessKey, region = 'us-east-1' }) {
    if (accessKeyId) {
      this.ec2 = new EC2({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      });
    } else {
      this.ec2 = new EC2({
        sslEnabled: true,
      });
    }
  }

  async defaultVPCInfo() {
    const { Vpcs: vpcs } = await this.ec2
      .describeVpcs({
        Filters: [
          {
            Name: 'isDefault',
            Values: ['true'],
          },
        ],
      })
      .promise();
    const { VpcId: vpcId } = vpcs.find(({ IsDefault }) => IsDefault);

    const { Subnets: subnets } = await this.ec2
      .describeSubnets({
        Filters: [
          {
            Name: 'vpc-id',
            Values: [vpcId],
          },
        ],
      })
      .promise();

    // Default subnets should be public, but just make sure
    const publicSubnets = subnets.filter(({ MapPublicIpOnLaunch }) => MapPublicIpOnLaunch);
    const { SubnetId: subnetId } = publicSubnets.reduce((result, subnet) =>
      subnet.AvailableIpAddressCount > result.AvailableIpAddressCount ? subnet : result,
    );
    return { vpcId, subnetId };
  }
}
