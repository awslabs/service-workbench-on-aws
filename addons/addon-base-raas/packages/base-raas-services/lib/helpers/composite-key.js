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
  };
}

module.exports = compositeKey;
