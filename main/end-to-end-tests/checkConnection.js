// This file is used for checking whether an IP Address is reachable on a particular port
// eslint-disable-next-line import/no-extraneous-dependencies
const tcpp = require('tcp-ping');

const [ipAddress, port] = process.argv.slice(2);
(async () => {
  const tcpPingPromise = (ipAddr, portForIp) =>
    new Promise((resolve, reject) => tcpp.probe(ipAddr, portForIp, (err, data) => (err ? reject(err) : resolve(data))));
  const response = await tcpPingPromise(ipAddress, port);
  console.log(response);
})();
