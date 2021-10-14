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
