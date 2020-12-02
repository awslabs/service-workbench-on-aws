const compositeKey = require('../../helpers/composite-key');

// accountIdCompositeKey is an object that helps us encode/decode the account id so that
// it can be used as a composite key in the table.
const accountIdCompositeKey = compositeKey(
  'ACT#',
  'ACT#',
  obj => ({ pk: obj.id, sk: obj.id }),
  pk => pk,
);

// bucketId is an object that helps us encode/decode accountId/bucket name combination so that
// it can be used as a composite key in the table.
const bucketIdCompositeKey = compositeKey(
  'ACT#',
  'BUK#',
  obj => ({ pk: obj.accountId, sk: obj.name }),
  (pk, sk) => ({ accountId: pk, name: sk }),
);

module.exports = {
  accountIdCompositeKey,
  bucketIdCompositeKey,
};
