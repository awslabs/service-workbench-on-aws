/*jshint esversion: 9 */
const request = require('request');
const jwkToPem = require('jwk-to-pem');
const _ = require('lodash');
const jwt = require('jsonwebtoken');

async function getAuth0TokenVerifier(userPoolUri, logger = console) {
  function toPem(keyDictionary) {
    const modulus = keyDictionary.n;
    const exponent = keyDictionary.e;
    const keyType = keyDictionary.kty;
    const jwk = {
      kty: keyType,
      n: modulus,
      e: exponent
    };
    const pem = jwkToPem(jwk);
    return pem;
  }

  // build key cache from cognito user pools
  const jwtKeySetUri = `${userPoolUri}.well-known/jwks.json`;
  const pemKeyCache = await new Promise((resolve, reject) => {
    request({
      url: jwtKeySetUri,
      json: true
    }, (error, response, body) => {
      if (!error && response && response.statusCode === 200) {
        const keys = body.keys;
        const keyCache = {};
        _.forEach(keys, key => {
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

  const verify = async token => {
    // First attempt to decode token before attempting to verify the signature
    const decodedJwt = jwt.decode(token, {
      complete: true
    });
    if (!decodedJwt) {
      throw new Error('Not valid JWT token. Could not decode the token');
    }

    // Fail if token is not from your User Pool
    if (decodedJwt.payload.iss !== userPoolUri) {
      throw new Error('Not valid JWT token. The token is not issued by the trusted source');
    }

    // Fail if the nonce is not from your sign-in url
    // TODO: make nonce random in sign-in url
    if (decodedJwt.payload.nonce !== 'NONCE') {
      throw new Error('Not valid JWT token. The token is not issued by the trusted source');
    }

    const keyId = decodedJwt.header.kid;
    const pem = pemKeyCache[keyId];
    if (!pem) {
      throw new Error('Not valid JWT token. No valid key available for verifying the token.');
    }
    const payload = await jwt.verify(token, pem);
    return payload;
  };

  return {
    verify
  };
}

module.exports = {
  getAuth0TokenVerifier
};