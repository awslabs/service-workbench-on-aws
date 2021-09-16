// Adapted from: https://stackoverflow.com/questions/65832576/converting-ssm-value-to-number

// To convert a boolean value to a string to be used by the serverless framework

module.exports = async serverless => {
  // Get params details from serverless.yml
  const enableEgressStore = serverless.service.custom.settings.enableEgressStore;

  // Must be explicitly equal to true and not just a "truthy" value
  return enableEgressStore === true ? 'true' : 'false';
};
