// ==============================================================================================================================
//  CONFIG (Change those parameters to adapt the script to your workspace)
// ==============================================================================================================================
// Save temporarily your token in a shell variable `$ export=API_TOKEN` or `c:\> $env:API_TOKEN = 'API_TOKEN' in Powershell`
// Fastest way to retrieve its value is to perform the manipulation on the application itself and get it from your WebBrowser's request

const API_TOKEN = process.env.API_TOKEN;
const API_HOSTNAME = ''; // 'XXXXXXXXXX.execute-api.<region>.amazonaws.com'
const REGION_NAME = '';
const REGION_SHORT_NAME = ''; // find the exhaustive list at ../../main/config/settings/.defaults.yml
const STAGE_NAME = ''; // 'galileo-dev'
const SOLUTION_NAME = 'galileo';
const TEST_NAME_PREFIX = ''; // 'SCALABILITY-TESTS' (Case sensitive + does not support whitespaces)
const PROJECT_NAME = ''; // 'SCALABILITY-TESTS-PROJECT' (Case sensitive + does not support whitespaces)

module.exports = {
    API_ROOT_END_POINT: `/${STAGE_NAME}/api`,

    TEST_NAME_PREFIX,
    PROJECT_NAME,

    REGION_NAME,
    TABLE_NAME: `${STAGE_NAME}-${REGION_SHORT_NAME}-${SOLUTION_NAME}-DbEnvironments`,

    BASIC_REQ_OPTIONS: {
        hostname: API_HOSTNAME,
        path: `/${STAGE_NAME}/api/workspaces`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_TOKEN}`,
        },
    },
};