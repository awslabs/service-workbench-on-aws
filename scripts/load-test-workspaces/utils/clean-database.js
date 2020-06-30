// ==============================================================================================================================
//  CLEAN TEST WORKSPACES FROM DYNAMO_DB TABLE
// ==============================================================================================================================

const { DynamoDB, config } = require("aws-sdk");
const { logResponses } = require("./helper-logger");

async function cleanUpTestWorkspacesFromDB(workspacesList, tableName, region) {
  config.update({ region });
  const DDB = new DynamoDB();

  const promises = [];
  workspacesList.forEach((workspace) => {
    const deleteParam = {
      Key: {
        id: { S: workspace.id },
      },
      TableName: tableName,
    };
    console.log(
      `Removing ${workspace.name} (id: ${workspace.id}) from the table...`
    );
    const promise = new Promise((resolve, reject) => {
      DDB.deleteItem(deleteParam, (err) => {
        if (err) {
          reject(
            new Error(
              "Error when sending the dynamoDb deleteItem request. Make sure you have your AWS credentials set."
            )
          );
        }
        resolve({ statusCode: 200 });
      });
    });
    promises.push(promise);
  });

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

module.exports = { cleanUpTestWorkspacesFromDB };
