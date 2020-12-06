const compositeKey = require('../../helpers/composite-key');

// resourceIdCompositeKey is an object that helps us encode/decode resource/count key combination so that
// it can be used as a composite key in the table.
const resourceIdCompositeKey = compositeKey(
  'RES#',
  'SN#',
  obj => ({ pk: obj.resource, sk: obj.setName }),
  (pk, sk) => ({ resource: pk, setName: sk }),
);

module.exports = {
  resourceIdCompositeKey,
};
