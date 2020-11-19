const _ = require('lodash');

const { bucketIdCompositeKey } = require('./composite-keys');

const bucketEntity = {
  fromDbToEntity: rawDb => {
    if (_.isNil(rawDb)) return rawDb;
    if (!_.isObject(rawDb)) return rawDb;

    const entity = { ...rawDb };
    const { accountId, name } = bucketIdCompositeKey.decode(entity);
    entity.accountId = accountId;
    entity.name = name;
    delete entity.pk;
    delete entity.sk;

    return entity;
  },
};

module.exports = {
  bucketEntity,
};
