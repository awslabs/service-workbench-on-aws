const Service = require('@aws-ee/base-services-container/lib/service');
const Ajv = require('ajv');

class JsonSchemaValidationService extends Service {
  /**
   * @throws a boom.badRequest with a payload of validation errors if objectToValidate has validation errors.
   */
  async ensureValid(objectToValidate, schemaToValidateAgainst) {
    const errors = await this.getValidationErrors(objectToValidate, schemaToValidateAgainst);
    if (errors.length > 0) {
      throw this.boom.badRequest('Input has validation errors', true).withPayload(
        {
          validationErrors: errors,
        },
        true,
      );
    }
  }

  /**
   * @returns an array of validation errors. If there are no errors, getValidationErrors will return an empty array.
   */
  async getValidationErrors(objectToValidate, schemaToValidateAgainst) {
    const ajv = new Ajv({ allErrors: true });
    ajv.validate(schemaToValidateAgainst, objectToValidate);
    return ajv.errors || [];
  }
}

module.exports = JsonSchemaValidationService;
