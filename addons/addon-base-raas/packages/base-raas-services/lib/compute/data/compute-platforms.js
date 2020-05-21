// A temporarily place to keep the information about the compute platforms and their configurations
const sagemaker = require('./sagemaker/platforms');
const emr = require('./emr/platforms');
const ec2 = require('./ec2/platforms');

const getPlatforms = (user = {}) => {
  return [...sagemaker.getPlatforms(user), ...emr.getPlatforms(user), ...ec2.getPlatforms(user)];
};

module.exports = {
  getPlatforms,
};
