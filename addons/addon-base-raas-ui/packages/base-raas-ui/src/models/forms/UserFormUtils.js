import _ from 'lodash';

/**
 * Returns identity provider options that can be used for displaying idp selection options
 * @param providerConfigs An array of authentication provider configuration objects. For details about the shape of
 * the object see "authenticationProviderConfigs" property of
 * "addons/addon-base-ui/packages/base-ui/src/models/authentication/AuthenticationProviderConfigsStore.js"
 *
 * @returns {[]}
 */
function toIdpOptions(providerConfigs) {
  const options = [];

  _.forEach(providerConfigs, providerConfig => {
    const config = providerConfig.config;

    // Each providerConfig (authentication provider) can have zero or more identity providers.
    if (!_.isEmpty(config.federatedIdentityProviders)) {
      _.forEach(config.federatedIdentityProviders, idp => {
        options.push({
          key: idp.id,
          text: idp.name,

          // Make sure the authentication provider's information is embedded in the value
          // along with the idp name. This is required so disambiguate two idps with the same idp name based on which
          // authentication provider they belong to
          value: JSON.stringify({ authNProviderId: providerConfig.id, idpName: idp.name }),
        });
      });
    }
  });
  return options;
}

// From string to object
function toIdpFromValue(value) {
  return JSON.parse(value);
}

// From object to string
function toValueFromIdp({ authenticationProviderId, identityProviderName }) {
  return JSON.stringify({ authNProviderId: authenticationProviderId, idpName: identityProviderName });
}

// eslint-disable-next-line import/prefer-default-export
export { toIdpOptions, toIdpFromValue, toValueFromIdp };
