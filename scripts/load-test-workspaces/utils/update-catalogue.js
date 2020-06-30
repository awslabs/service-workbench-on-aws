// ==============================================================================================================================
//  UPDATE THE CATALOGUE OF WORKSPACES (used to validate requests before reaching the API)
// ==============================================================================================================================

const { writeFileSync } = require("fs");
const { makeApiRequest } = require("./helper-requests");
const { API_ROOT_END_POINT } = require("../config/test-config");

async function updateWorkspacesCatalogue(options) {
  const catalogue = [];

  const request = {
    ...options,
    method: "GET",
  };

  // Get the list of platforms
  let platformsList;
  request.path = `${API_ROOT_END_POINT}/compute/platforms`;
  try {
    platformsList = await makeApiRequest(request);
  } catch (err) {
    throw new Error(
      "Error when trying to send requests to the API Gateway. Make sure defined properly your test configuration in ./config/test-config.js"
    );
  }
  if (!Array.isArray(JSON.parse(platformsList.body))) {
    throw new Error(
      `Error when fetching the eligible list of platforms : your api token might not be authorized. response.body: ${platformsList.body}`
    );
  }
  JSON.parse(platformsList.body).forEach((platform) => {
    catalogue.push({ platform: platform.id, configurations: [] });
  });

  // Fetch the list of configurations of each platform
  const promises = [];
  for (let i = 0; i < catalogue.length; i += 1) {
    request.path = `${API_ROOT_END_POINT}/compute/platforms/${catalogue[i].platform}/configurations`;
    const platformConfigs = makeApiRequest(request);
    promises.push(platformConfigs);
  }

  // Wait for the resolution of all the requests
  const responses = await Promise.all(promises);
  for (let i = 0; i < catalogue.length; i += 1) {
    JSON.parse(responses[i].body).forEach((conf) => {
      catalogue[i].configurations[conf.displayOrder - 1] = conf.id;
    });
    catalogue[i].configurations = catalogue[i].configurations.filter(Boolean); // remove empty elements
  }

  writeFileSync(
    `${__dirname}/../config/workspaces-catalogue.json`,
    JSON.stringify(catalogue, null, 4)
  );

  console.log(
    "Catalogue successfully updated and saved in ./config/workspaces-catalogue.json !"
  );
}

module.exports = { updateWorkspacesCatalogue };
