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

    // If native user pool is enabled, add Cognito User Pool
    if (!_.isUndefined(config.enableNativeUserPoolUsers) && config.enableNativeUserPoolUsers) {
      options.push({
        key: config.title,
        text: config.title,
        value: JSON.stringify({
          authNProviderId: config.id,
          idpName: config.title,
        }),
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
