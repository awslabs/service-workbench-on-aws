
const { AppStreamClient, DescribeImageBuildersCommand, CreateImageBuilderCommand } = require("@aws-sdk/client-appstream");

async function run() {
    const profile = process.argv[2];
    const region = process.argv[3];
    console.log(`Starting Image Builder using AWS Profile ${profile} in region ${region}`);

    const client = new AppStreamClient({ region, profile});
    const imageBuilderName = `SWBImageBuilder-${Date.now()}`;
    await createImageBuilder(client, imageBuilderName);
    await waitForImageBuilderToBeReady(client, imageBuilderName);

    const imageBuilderUrl = `https://console.aws.amazon.com/appstream2/home?region=${region}#/images?bottomTab=details&topTab=image-builders`

    console.log(`You can find your new Image Builder at this address ${imageBuilderUrl}`)
}

async function createImageBuilder(client, imageBuilderName) {
    console.log(`Starting image builder with name ${imageBuilderName}`)
    try {
        await client.send(
            new CreateImageBuilderCommand({
                InstanceType: 'stream.graphics.g4dn.xlarge',
                Name: imageBuilderName,
                ImageName: 'AppStream-Graphics-G4dn-WinServer2019-06-01-2021',
                DisplayName: imageBuilderName,
                VpcConfig: {
                    SubnetIds: [
                        'subnet-13f5b44c'
                    ]
                },
                EnableDefaultInternetAccess: true
                }
            )
        );
    } catch (e) {
        console.log("Failed to start image builder");
        throw e;
    }
}

async function waitForImageBuilderToBeReady(client, name) {
    let imageInRunningState = false;
    while (!imageInRunningState) {
        await new Promise(r => setTimeout(r, 5000));
        const decribeImageBuilderResponse = await client.send(new DescribeImageBuildersCommand({
            Names: [
                name
            ]
        }));
        const imageState = decribeImageBuilderResponse.ImageBuilders[0].State;
        console.log(`Image Builder is in ${imageState} state`)
        imageInRunningState = imageState === 'RUNNING';
    }
}
(async() => {
    await run();
})();

