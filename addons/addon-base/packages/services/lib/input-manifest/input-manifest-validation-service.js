const Service = require('@aws-ee/base-services-container/lib/service');
const { validateSection } = require('./input-manifest');

module.exports = class InputManifestValidationService extends Service {
  /**
   * @returns Array of validation errors. If there are no errors, then returns an empty array.
   */
  async getValidationErrors(inputManifest, config) {
    const { sections = [] } = inputManifest;
    const errors = [];
    sections.forEach(section => {
      errors.push(...validateSection(section, config));
    });
    return errors;
  }
};
