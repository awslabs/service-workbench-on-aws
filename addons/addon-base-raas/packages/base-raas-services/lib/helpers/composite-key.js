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

const { chopLeft } = require('./utils');

function compositeKey(pkPrefix, skPrefix, encodeFn, decodeFn) {
  return {
    encode: obj => {
      const { pk, sk } = encodeFn(obj);
      return { pk: `${pkPrefix}${pk}`, sk: `${skPrefix}${sk}` };
    },

    decode: obj => {
      const pk = chopLeft(obj.pk, pkPrefix);
      const sk = chopLeft(obj.sk, skPrefix);
      return decodeFn(pk, sk);
    },

    pk: pk => `${pkPrefix}${pk}`,
    sk: sk => `${skPrefix}${sk}`,

    pkPrefix,
    skPrefix,
  };
}

module.exports = compositeKey;
