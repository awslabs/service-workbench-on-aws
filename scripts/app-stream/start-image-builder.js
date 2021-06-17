
const { AppStreamClient, DescribeImageBuildersCommand, CreateImageBuilderCommand } = require("@aws-sdk/client-appstream");
const { DescribeVpcsCommand, EC2Client, DescribeSubnetsCommand} = require("@aws-sdk/client-ec2");

class StartImageBuilder {
    constructor(profile, region) {
        console.log(`Starting Image Builder using AWS Profile ${profile} in region ${region}`);
        this.appStreamClient = new AppStreamClient({ region, profile});
        this.region = region;
        this.ec2Client = new EC2Client({region, profile});
        this.imageBuilderName = `SWBImageBuilder-${Date.now()}`;
    }

    async run() {
        try {
            await this.createImageBuilder();
            await this.waitForImageBuilderToBeReady();

            const imageBuilderUrl = `https://console.aws.amazon.com/appstream2/home?region=${this.region}#/images?bottomTab=details&topTab=image-builders`

            console.log(`You can find your new Image Builder at this address ${imageBuilderUrl}`)
        } catch (e) {
            process.exit(1);
        }
    }

    async createImageBuilder() {
        console.log(`Starting image builder with name ${this.imageBuilderName}`)
        try {
            const vpcsResponse = await this.ec2Client.send(
                new DescribeVpcsCommand({
                    Filters: [{
                        Name: 'isDefault',
                        Values: [true]
                    }]
                })
            );
            const vpcId = vpcsResponse.Vpcs[0].VpcId;
            const subnetsResponse = await this.ec2Client.send(
                new DescribeSubnetsCommand({
                    Filters: [
                        {
                            Name: 'vpc-id',
                            Values: [vpcId]
                        }
                    ]
                })
            )

            const subnetId = subnetsResponse.Subnets[0].SubnetId;

            await this.appStreamClient.send(
                new CreateImageBuilderCommand({
                        InstanceType: 'stream.graphics.g4dn.xlarge',
                        Name: this.imageBuilderName,
                        ImageName: 'AppStream-Graphics-G4dn-WinServer2019-06-01-2021',
                        DisplayName: this.imageBuilderName,
                        VpcConfig: {
                            SubnetIds: [
                                subnetId
                            ]
                        },
                        EnableDefaultInternetAccess: true
                    }
                )
            );
        } catch (e) {
            console.error("Failed to start image builder", e);
            throw e;
        }
    }

    async waitForImageBuilderToBeReady() {
        try {
            console.log("Waiting for Image Builder to be in RUNNNING state. This can take 5 to 10 minutes");
            let imageInRunningState = false;
            while (!imageInRunningState) {
                await new Promise(r => setTimeout(r, 5000));
                const decribeImageBuilderResponse = await this.appStreamClient.send(new DescribeImageBuildersCommand({
                    Names: [
                        this.imageBuilderName
                    ]
                }));
                const imageState = decribeImageBuilderResponse.ImageBuilders[0].State;
                console.log(`Image Builder is in ${imageState} state`)
                imageInRunningState = imageState === 'RUNNING';
            }
        } catch (e) {
            console.error("Failed to check for Image Builder status", e);
            throw e;
        }
    }

}

const startImageBuilder = new StartImageBuilder(process.argv[2], process.argv[3]);
startImageBuilder.run();
