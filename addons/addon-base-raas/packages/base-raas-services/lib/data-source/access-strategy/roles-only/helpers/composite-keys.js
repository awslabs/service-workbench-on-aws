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

const _ = require('lodash');

const compositeKey = require('../../../../helpers/composite-key');

// appRoleIdCompositeKey is an object that helps us encode/decode the account id and the
// app role arn so that it can be used as a composite key in the table.
const appRoleIdCompositeKey = compositeKey(
  'ACT#',
  'APP#',
  obj => ({ pk: obj.accountId, sk: `${obj.bucket}#${obj.arn}` }),
  (pk, sk) => {
    const split = _.split(sk, '#');
    return {
      accountId: pk,
      bucket: _.nth(split, 0),
      arn: _.nth(split, 1),
    };
  },
);

// fsRoleIdCompositeKey is an object that helps us encode/decode the account id and the
// filesystem role arn so that it can be used as a composite key in the table.
const fsRoleIdCompositeKey = compositeKey(
  'ACT#',
  'FS#',
  obj => ({ pk: obj.accountId, sk: `${obj.bucket}#${obj.arn}` }),
  (pk, sk) => {
    const split = _.split(sk, '#');
    return {
      accountId: pk,
      bucket: _.nth(split, 0),
      arn: _.nth(split, 1),
    };
  },
);

module.exports = {
  appRoleIdCompositeKey,
  fsRoleIdCompositeKey,
};
