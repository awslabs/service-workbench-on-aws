"use strict"

const yargs = require('yargs');
const workspacesCatalogue = require('../config/workspaces-catalogue.json');

// ==============================================================================================================================
//  COMMAND LINE DEFINITION
// ==============================================================================================================================
function parseCLIArguments() {
    let catalogueToString = '';
    workspacesCatalogue.forEach(page => {
        catalogueToString += `\n[${page.platform}]: ${page.configurations.join('  ')}`;
    })

    const argv = yargs
        .command('create', '--> Create workspaces simultaneously.')
        .command('access', '--> Access workspaces simultaneously.')
        .command('terminate', '--> Terminate workspaces simultaneously.')
        .command('delete', '--> Delete load test workspaces from dynamoDB simultaneously.')
        .command('start', '--> Start workspaces simultaneously.')
        .command('stop', '--> Stop workspaces simultaneously.')
        .command('update-catalogue', '--> Download the up-to-date catalogue of workspaces in ./load-test-workspaces.catalogue.json.')
        .option('count', {
            description: 'Count of simultaneous workspaces to operate on',
            type: 'number',
        })
        .option('platform', {
            description: 'Platform providing the AMI for the new workspaces to use ("sagemaker-1" | "ec2-linux-1" | "ec2-windows-1" | "emr-1)',
            type: 'string',
        })
        .option('size', {
            description: 'Size of the workspaces to operate on.\n' +
                catalogueToString + '\n\n' +
                'Full catalogue is stored in ./config/workspaces-catalogue.json, and updated with the command update-catalogue\n\n',
            type: 'string',
        })
        .help()
        .argv;

    if (argv._.length !== 1) {
        throw new Error('Exactly one command should be used : "create" || "access" || "terminate" || "delete" || "start" || "stop"');
    }
    return argv;
}

function validateCLIArguments(argv) {
    const command = argv._[0];

    // Check if arguments are missing
    const requestedArguments = {
        "create": ['count', 'size', 'platform'],
        "access": [],
        "terminate": [],
        "delete": [],
        "start": [],
        "stop": [],
        "update-catalogue": [],
    }
    const missingArgs = [];
    requestedArguments[command].forEach(argument => {
        if (argv[argument] === undefined) {
            missingArgs.push(argument);
        }
    });
    if (missingArgs.length > 0) {
        throw new Error(`Missing Arguments for command ${command} : ${missingArgs}`);
    }

    // If a platform argument exists, check its validity against the workspaces catalogue
    if (argv.platform !== undefined) {
        let count = 0;
        while (count < workspacesCatalogue.length && workspacesCatalogue[count].platform !== argv.platform) {
            count += 1;
        }
        if (count >= workspacesCatalogue.length) {
            throw new Error(
                `Platform ${argv.platform} does not exist in the catalogue.\n` +
                `Use the 'node load-test-workspaces.js help' command to read the catalogue or make sure that the catalogue is up-to-date by running 'node load-test-workspaces.js update-catalogue'.`
            );
        }
    }

    // If a size argument exists, check it's validity regarding the platform argument
    if (argv.size !== undefined) {
        const validPlatforms = [];
        workspacesCatalogue.forEach(platform => {
            if (platform.configurations.includes(argv.size)) {
                validPlatforms.push(platform.platform);
            }
        });
        if (validPlatforms.length === 0) {
            throw new Error(`Invalid size argument (${argv.size}) does not exist in the catalogue.`);
        }
        else if (!validPlatforms.includes(argv.platform)) {
            throw new Error(
                `The size argument (${argv.size}) is not valid regarding the platform argument (${argv.platform}).\n` +
                `If you wish to keep this size, set the platform argument to one of tese values: ${validPlatforms}.`
            );
        }
    }

    // Count should be an integer greater than 0
    if (Number.isNaN(argv.count)) {
        throw new Error(`Argument--count should be an integer greater than 0`);
    }
    else if (argv.count <= 0) {
        throw new Error(`Argument--count should be an integer greater than 0`);
    }
}

module.exports = { parseCLIArguments, validateCLIArguments };