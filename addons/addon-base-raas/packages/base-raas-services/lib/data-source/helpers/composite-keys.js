/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

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
