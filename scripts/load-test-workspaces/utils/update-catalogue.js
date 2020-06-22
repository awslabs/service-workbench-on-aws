"use strict"

// ==============================================================================================================================
//  UPDATE THE CATALOGUE OF WORKSPACES (used to validate requests before reaching the API)
// ==============================================================================================================================

const { makeApiRequest } = require('../utils/helper-requests');
const { API_ROOT_END_POINT } = require('../config/test-config');
const { writeFileSync } = require('fs');

async function updateWorkspacesCatalogue(request_options) {

    const catalogue = [];

    const req_options = {
        ...request_options,
        method: 'GET'
    };

    // Get the list of platforms
    let platformsList;
    req_options.path = `${API_ROOT_END_POINT}/compute/platforms`;
    try {
        platformsList = await makeApiRequest(req_options);
    } catch {
        throw new Error('Error when trying to send requests to the API Gateway. Make sure defined properly your test configuration in ./load-test-workspaces.config.js');
    }
    if (!Array.isArray(JSON.parse(platformsList.body))) {
        throw new Error(`Error when fetching the eligible list of platforms : your api token might not be authorized. response.body: ${platformsList.body}`);
    }
    JSON.parse(platformsList.body).forEach((platform) => {
        catalogue.push({ "platform": platform.id, "configurations": [] });
    });

    // Fetch the list of configurations of each platform
    for (let i = 0; i < catalogue.length; i++) {
        let configurationsList;
        req_options.path = `${API_ROOT_END_POINT}/compute/platforms/${catalogue[i].platform}/configurations`;
        try {
            configurationsList = await makeApiRequest(req_options);
        } catch {
            throw new Error('Error when trying to send requests to the API Gateway. Make sure defined properly your test configuration in ./load-test-workspaces.config.js');
        }
        if (!Array.isArray(JSON.parse(configurationsList.body))) {
            throw new Error(`Error when fetching the eligible list of platforms : your api token might not be authorized. response.body: ${platformsList.body}`);
        }
        JSON.parse(configurationsList.body).forEach(conf => {
            catalogue[i].configurations[conf.displayOrder - 1] = conf.id;
        });
        catalogue[i].configurations = catalogue[i].configurations.filter(Boolean); // remove empty elements
    }

    writeFileSync(__dirname + '/../config/workspaces-catalogue.json', JSON.stringify(catalogue, null, 4));

    console.log('Catalogue successfully updated and saved in ./config/workspaces-catalogue.json !');
}

module.exports = { updateWorkspacesCatalogue };