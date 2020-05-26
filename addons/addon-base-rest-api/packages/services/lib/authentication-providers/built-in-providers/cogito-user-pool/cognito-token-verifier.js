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

const request = require('request');
const jwkToPem = require('jwk-to-pem');
const _ = require('lodash');
const jwt = require('jsonwebtoken');

async function getCognitoTokenVerifier(userPoolUri, logger = console) {
  function toPem(keyDictionary) {
    const modulus = keyDictionary.n;
    const exponent = keyDictionary.e;
    const keyType = keyDictionary.kty;
    const jwk = { kty: keyType, n: modulus, e: exponent };
    const pem = jwkToPem(jwk);
    return pem;
  }

  // build key cache from cognito user pools
  const jwtKeySetUri = `${userPoolUri}/.well-known/jwks.json`;
  const pemKeyCache = await new Promise((resolve, reject) => {
    request({ url: jwtKeySetUri, json: true }, (error, response, body) => {
      if (!error && response && response.statusCode === 200) {
        const keys = body.keys;
        const keyCache = {};
        _.forEach(keys, (key) => {
          // kid = key id
          const kid = key.kid;
          keyCache[kid] = toPem(key);
        });
        resolve(keyCache);
      } else {
        logger.error('Failed to retrieve the keys from the well known user-pool URI');
        reject(error);
      }
    });
  });

  const verify = async (token) => {
    // First attempt to decode token before attempting to verify the signature
    const decodedJwt = jwt.decode(token, { complete: true });
    if (!decodedJwt) {
      throw new Error('Not valid JWT token. Could not decode the token');
    }

    // Fail if token is not from your User Pool
    if (decodedJwt.payload.iss !== userPoolUri) {
      throw new Error('Not valid JWT token. The token is not issued by the trusted source');
    }

    // Reject the jwt if it's not an 'Identity Token'
    if (decodedJwt.payload.token_use !== 'id') {
      throw new Error('Not valid JWT token. The token is not the identity token');
    }

    const keyId = decodedJwt.header.kid;
    const pem = pemKeyCache[keyId];
    if (!pem) {
      throw new Error('Not valid JWT token. No valid key available for verifying the token.');
    }

    const payload = await jwt.verify(token, pem, { issuer: userPoolUri });
    return payload;
  };

  return { verify };
}

module.exports = { getCognitoTokenVerifier };
