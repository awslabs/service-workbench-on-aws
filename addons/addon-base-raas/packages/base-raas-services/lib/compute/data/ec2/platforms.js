// A temporarily place to keep the information about the compute platforms
const _ = require('lodash');

const platforms = [
  {
    id: 'ec2-linux-1',
    type: 'ec2-linux',
    title: 'EC2 - Linux',
    displayOrder: 3,
    desc: `Secure, resizable compute in the cloud`,
  },
  {
    id: 'ec2-windows-1',
    type: 'ec2-windows',
    title: 'EC2 - Windows',
    displayOrder: 4,
    desc: `Secure, resizable compute in the cloud`,
  },
];

// Which user can view which type
const getPlatforms = user => (_.get(user, 'userRole') !== 'external-researcher' ? _.slice(platforms) : []); // external researchers can't view ec2 platforms for now

module.exports = {
  getPlatforms,
};
