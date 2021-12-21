/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */
async function mountStudies(ssh, studyId) {
  const output = await ssh.execCommand(`source ~/.bash_profile && cd ~/studies/${studyId} && touch output.txt && ls`);
  return output;
}

// This method aides in the advanced integration test to check study permission levels on workspaces
// by performing the following operations:
// 1. Reads the contents of the study folder (verifies read priveleges)
// 2. Writes random content into a new file in that study folder, and lists to confirm file can be viewed (verifies write priveleges)
async function readWrite(ssh, studyId, numberOfBytes = 20) {
  const output = await ssh.execCommand(
    `cd ~/studies/${studyId} && ls -l && head -c ${numberOfBytes} </dev/urandom >output.txt && ls -l`,
  );
  return output;
}
module.exports = { mountStudies, readWrite };
