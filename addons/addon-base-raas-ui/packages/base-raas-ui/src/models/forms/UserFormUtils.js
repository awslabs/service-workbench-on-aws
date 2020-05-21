import _ from 'lodash';

function toIdpOptions(providerConfigs) {
  const options = [];
  _.forEach(providerConfigs, providerConfig => {
    const config = providerConfig.config;
    if (!_.isEmpty(config.federatedIdentityProviders)) {
      _.forEach(config.federatedIdentityProviders, idp => {
        options.push({
          key: idp.id,
          text: idp.name,
          value: idp.name,
        });
      });
    }
  });
  return options;
}

// eslint-disable-next-line import/prefer-default-export
export { toIdpOptions };
