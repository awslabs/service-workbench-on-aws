// ==============================================================================================================================
//  CONFIG (Change those parameters to adapt the script to your workspace)
// ==============================================================================================================================
// Save temporarily your token in a shell variable `$ export=API_TOKEN` or `c:\> $env:API_TOKEN = 'API_TOKEN' in Powershell`
// Fastest way to retrieve its value is to perform the manipulation on the application itself and get it from your WebBrowser's request

const API_TOKEN = process.env.API_TOKEN;
const API_HOSTNAME = ''; // 'XXXXXXXXXX.execute-api.<region>.amazonaws.com'
const REGION_NAME = '';
const STAGE_NAME = ''; // 'galileo-dev'
const TEST_NAME_PREFIX = ''; // 'SCALABILITY TESTS'
const PROJECT_NAME = ''; // 'SCALABILITY TESTS PROJECT'

const config = {
    TEST_NAME_PREFIX,
    PROJECT_NAME,

    REGION_NAME,
    TABLE_NAME: `${STAGE_NAME}-va-galileo-DbEnvironments`,

    BASIC_REQ_OPTIONS: {
        hostname: API_HOSTNAME,
        path: `/${STAGE_NAME}/api/workspaces`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_TOKEN}`,
        },
    },

    DEFAULT_SIZE: {
        'rstudio': 't3.xlarge',
        'sagemaker': 'ml.t3.medium'
    },
}

module.exports = config;