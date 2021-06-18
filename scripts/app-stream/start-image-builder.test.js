const {mockClient} = require('aws-sdk-client-mock');
const { DescribeVpcsCommand, EC2Client, DescribeSubnetsCommand} = require("@aws-sdk/client-ec2");
const { AppStreamClient, DescribeImageBuildersCommand, CreateImageBuilderCommand } = require("@aws-sdk/client-appstream");

const {StartImageBuilder} = require('./start-image-builder');

describe('start-image-builder', () => {

    const appStreamMock = mockClient(AppStreamClient);
    const ec2Mock = mockClient(EC2Client);
    describe('createImageBuilder', () => {
        beforeEach(() => {
            appStreamMock.reset();
            ec2Mock.reset();
        })

        test('start image builder successfully', async () => {
            // BUILD
            const startImageBuilder = new StartImageBuilder('default', 'us-east-1', 'default', 'default');
            ec2Mock
                .on(DescribeVpcsCommand)
                .resolves({
                    Vpcs: [
                        {
                            VpcId: 'vpc123'
                        }
                    ]

                })
            ec2Mock
                .on(DescribeSubnetsCommand)
                .resolves(
                    {
                        Subnets: [
                            {
                                SubnetId: 'subnet123'
                            }
                        ]
                    }
                )

            appStreamMock
                .on(CreateImageBuilderCommand)
                .resolves();

            // OPERATE
            await startImageBuilder.createImageBuilder();

            const nameRegEx = /SWBImageBuilder-\d{13}/;
            // CHECK
            expect(appStreamMock.calls(0)[0].args[0].input).toEqual({
                "DisplayName": expect.stringMatching(nameRegEx),
                "EnableDefaultInternetAccess": true,
                "ImageName": "AppStream-WinServer2019-06-01-2021",
                "InstanceType": "stream.standard.medium",
                "Name": expect.stringMatching(nameRegEx),
                "VpcConfig": {
                    "SubnetIds": [
                        "subnet123"
                    ]
                }
            });
        })
        test('failed to get default vpc', async () => {
            const startImageBuilder = new StartImageBuilder('default', 'us-east-1', 'default', 'default');
            const ec2Mock = mockClient(EC2Client);
            ec2Mock
                .on(DescribeVpcsCommand)
                .rejects('Describe VPCs failed');

            await expect(startImageBuilder.createImageBuilder()).rejects.toEqual(new Error('Describe VPCs failed'));

        })
    })

    describe('waitForImageBuilderToBeReady', () => {
        beforeEach(() => {
            appStreamMock.reset();
        })

        test('AppStream builder transitioned to RUNNING state', async() => {
            // BUILD
            const startImageBuilder = new StartImageBuilder('default', 'us-east-1', 'default', 'default');

            appStreamMock
                .on(DescribeImageBuildersCommand)
                .resolves({
                    ImageBuilders: [
                        {
                            State: 'RUNNING'
                        }
                    ]
                })

            // OPERATE
            await startImageBuilder.waitForImageBuilderToBeReady();

            // CHECK
            expect(appStreamMock.calls().length).toEqual(1);
        }, 10000)

    })
})