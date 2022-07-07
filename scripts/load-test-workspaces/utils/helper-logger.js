function logResponses(responses, workspacesList) {
  for (let i = 0; i < responses.length; i += 1) {
    console.log(
      `[${workspacesList[i].name}] : response status ---> ${responses[i].statusCode}`
    );
  }

  for (let i = 0; i < responses.length; i += 1) {
    if (responses[i].statusCode !== 200) {
      console.log(
        `[RESPONSE ${responses[i].statusCode} for ${workspacesList[i].name}]. Response body :`
      );
      console.log(responses[i].body);
    }
  }
}

module.exports = { logResponses };
