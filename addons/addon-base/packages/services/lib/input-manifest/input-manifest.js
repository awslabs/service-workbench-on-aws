const Validator = require('validatorjs');
const { template: underscoreTemplate } = require('underscore');

const flatten = (entry, config) => {
  const out = [];
  const { condition, children = [] } = entry;
  if (!condition || underscoreTemplate(condition)(config) === 'true') {
    out.push(entry);
    children.forEach(child => {
      out.push(...flatten(child, config));
    });
  }
  return out;
};

const flattenSection = ({ condition, children = [] }, config) => {
  const out = [];
  if (!condition || underscoreTemplate(condition)(config) === 'true') {
    children.forEach(child => {
      out.push(...flatten(child, config));
    });
  }
  return out;
};

const validateSection = (section, config, extraKeysAreInvalid = false) => {
  const keysMissingInManifest = new Set(Object.keys(config));
  const errors = flatten(section, config)
    .map(({ name, value: defaultValue, rules }) => {
      keysMissingInManifest.delete(name);
      if (!rules || rules === '') {
        return null;
      }
      const configValue = config[name];
      const validation = new Validator(
        {
          [name]: typeof configValue === 'undefined' ? defaultValue : configValue,
        },
        {
          [name]: rules,
        },
      );
      return validation.passes()
        ? null
        : {
            type: 'invalid',
            message: validation.errors.first(name) || `The ${name} value is invalid`,
          };
    })
    .filter(err => !!err);
  if (extraKeysAreInvalid) {
    errors.push(
      ...Array.from(keysMissingInManifest).map(name => ({
        type: 'extra',
        message: `The ${name} is present in config but missing in manifest`,
      })),
    );
  }
  return errors;
};

module.exports = {
  flattenSection,
  validateSection,
};
