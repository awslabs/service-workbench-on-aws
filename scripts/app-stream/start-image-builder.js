const {
  AppStreamClient,
  DescribeImageBuildersCommand,
  CreateImageBuilderCommand,
} = require("@aws-sdk/client-appstream");
const {
  DescribeVpcsCommand,
  EC2Client,
  DescribeSubnetsCommand,
} = require("@aws-sdk/client-ec2");

const StartImageBuilder = class StartImageBuilder {
  constructor(profile, region, imageName, imageSize) {
    if (!profile || !region || !imageName || !imageSize) {
      console.log(
        "Please provide a value for AWS Profile, region, image name, and image size"
      );
      process.exit(1);
    }
    this.appStreamClient = new AppStreamClient({ region, profile });
    this.region = region;
    this.ec2Client = new EC2Client({ region, profile });
    this.imageBuilderName = `SWBImageBuilder-${Date.now()}`;
    this.imageName =
      imageName === "default"
        ? "AppStream-WinServer2019-10-08-2021"
        : imageName;
    this.imageSize =
      imageSize === "default" ? "stream.standard.medium" : imageSize;
    console.log(
      `Starting Image Builder using AWS Profile ${profile} in region ${region} with base image ${this.imageName} and instance type ${this.imageSize}`
    );
  }

  async run() {
    try {
      await this.createImageBuilder();
      await this.waitForImageBuilderToBeReady();

      const imageBuilderUrl = `https://console.aws.amazon.com/appstream2/home?region=${this.region}#/images?bottomTab=details&topTab=image-builders`;

      console.log(
        `You can find your new Image Builder at this address ${imageBuilderUrl}`
      );
    } catch (e) {
      process.exit(1);
    }
  }

  async createImageBuilder() {
    console.log(`Starting image builder with name ${this.imageBuilderName}`);
    try {
      const vpcsResponse = await this.ec2Client.send(
        new DescribeVpcsCommand({
          Filters: [
            {
              Name: "isDefault",
              Values: [true],
            },
          ],
        })
      );
      const vpcId = vpcsResponse.Vpcs[0].VpcId;
      const subnetsResponse = await this.ec2Client.send(
        new DescribeSubnetsCommand({
          Filters: [
            {
              Name: "vpc-id",
              Values: [vpcId],
            },
          ],
        })
      );

      const subnetId = subnetsResponse.Subnets[0].SubnetId;

      await this.appStreamClient.send(
        new CreateImageBuilderCommand({
          InstanceType: this.imageSize,
          Name: this.imageBuilderName,
          ImageName: this.imageName,
          DisplayName: this.imageBuilderName,
          VpcConfig: {
            SubnetIds: [subnetId],
          },
          EnableDefaultInternetAccess: true,
        })
      );
    } catch (e) {
      console.error("Failed to start image builder", e);
      throw e;
    }
  }

  async waitForImageBuilderToBeReady() {
    try {
      console.log(
        "Waiting for Image Builder to finish starting up. This can take 5 to 10 minutes"
      );
      let imageInPendingState = true;
      let imageState = "";
      while (imageInPendingState) {
        await new Promise((r) => setTimeout(r, 5000));
        const decribeImageBuilderResponse = await this.appStreamClient.send(
          new DescribeImageBuildersCommand({
            Names: [this.imageBuilderName],
          })
        );
        imageState = decribeImageBuilderResponse.ImageBuilders[0].State;
        console.log(`Image Builder is in ${imageState} state`);
        imageInPendingState = imageState === "PENDING";
      }
      if (imageState !== "RUNNING") {
        console.log(
          `Image Builder ${this.imageBuilderName} failed to transition to RUNNING state. Image Builder is in ${imageState} state`
        );
      } else {
        console.log(
          `Image Builder ${this.imageBuilderName} is now in RUNNING state`
        );
      }
    } catch (e) {
      console.error("Failed to check for Image Builder status", e);
      throw e;
    }
  }
};

const runCodeAsScript = () => {
  const startImageBuilder = new StartImageBuilder(
    process.argv[1],
    process.argv[2],
    process.argv[3],
    process.argv[4]
  );
  startImageBuilder.run();
};

module.exports = {
  StartImageBuilder,
  runCodeAsScript,
};
