// A temporarily place to keep the information about the compute platforms and their configurations
const sagemaker = require('./sagemaker/configurations');
const emr = require('./emr/configurations');
const ec2 = require('./ec2/configurations');

const getConfigurations = (platformId, user = {}) => {
  return [
    ...sagemaker.getConfigurations(platformId, user),
    ...emr.getConfigurations(platformId, user),
    ...ec2.getConfigurations(platformId, user),
  ];
};

module.exports = {
  getConfigurations,
};
