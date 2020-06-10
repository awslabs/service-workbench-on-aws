// ==============================================================================================================================
//  CONFIG (Change those parameters to adapt the script to your workspace)
// ==============================================================================================================================
// Save temporarily your token in a shell variable `$ export=API_TOKEN` or `c:\> $env:API_TOKEN = 'API_TOKEN' in Powershell`
// Fastest way to retrieve its value is to perform the manipulation on the application itself and get it from your WebBrowser's request

const API_TOKEN = process.env.API_TOKEN;
const API_HOSTNAME = '' // 'pih5shmr7e.execute-api.us-east-1.amazonaws.com'
const REGION_NAME = '' // 'us-east-1';
const STAGE_NAME = '' // 'dbmi-dev';
const TEST_NAME_PREFIX = 'LOAD TESTS';
const PROJECT_NAME = '' // 'LOAD TESTING PROJECT';

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