const _ = require('lodash');

function normalizeValue(value) {
  if (_.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (_.isObject(value)) {
    return normalizeKeys(value);
  }
  return value;
}

function normalizeKeys(obj) {
  return Object.entries(obj).reduce((result, [key, value]) => {
    // lowercase the first letter of the words in the key, unless the whole word is uppercase
    // in which case lowercase the entire word
    const normalizedKey = key
      .split(' ')
      .map(word => (/^[A-Z]*$/.test(word) ? word.toLowerCase() : `${word.slice(0, 1).toLowerCase()}${word.slice(1)}`))
      .join(' ');
    const normalizedValue = normalizeValue(value);
    return { ...result, [normalizedKey]: normalizedValue };
  }, {});
}

function basicProjection({ id, tags, name, description, resources, studyCategory }) {
  return {
    id,
    name,
    description,
    category: studyCategory,
    tags,
    resources: resources.map(({ arn }) => ({ arn })),
  };
}

module.exports = {
  normalizeKeys,
  basicProjection,
};
