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
// This file is used for checking whether an IP Address is reachable on a particular port
// eslint-disable-next-line import/no-extraneous-dependencies
const tcpp = require('tcp-ping');

const [ipAddress, port] = process.argv.slice(2);
(async () => {
  const tcpPingPromise = (ipAddr, portForIp) =>
    new Promise((resolve, reject) => tcpp.probe(ipAddr, portForIp, (err, data) => (err ? reject(err) : resolve(data))));
  const response = await tcpPingPromise(ipAddress, port);
  // If the ping was successful the exit code should be 0
  if (response) {
    process.exit(0);
  }
  process.exit(1);
})();
