import _ from 'lodash';
import Validator from 'validatorjs';

/**
 * Transforms fields object from
 {
  fieldName1: {
    rules: string,
  },
  fieldName2: {
    rules: string,
  },
 }

 to

 {
  fieldName1: rulesString,
  fieldName2: rulesString,
 }
 *
 */
function fieldsToValidationRules(fieldsConfig) {
  return _.transform(
    fieldsConfig,
    (rules, config, fieldName) => {
      if (config.rules) {
        rules[fieldName] = config.rules;
      }
      return rules;
    },
    {},
  );
}

/**
 * Validates given input data using the form fields configuration
 *
 * @param input The object to validate
 * @param fieldsConfig The field configuration to use for validation. The config must be in the following format.
 {
  fieldName1: {
    rules: string,
  },
  fieldName2: {
    rules: string,
  },
 }
 * @returns {Promise<Validator>}
 */
async function validate(input, fieldsConfig) {
  const validationRules = fieldsToValidationRules(fieldsConfig);
  let validation;
  if (validationRules) {
    validation = new Validator(input, validationRules);
  }
  return validation;
}

export default validate;
