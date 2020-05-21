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
