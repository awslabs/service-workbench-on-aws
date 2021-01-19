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
const { ensureAdmin } = require('@aws-ee/base-services/lib/authorization/assertions');
const { newInvoker } = require('@aws-ee/base-api-services/lib/authentication-providers/helpers/invoker');
const authProviderConstants = require('@aws-ee/base-api-services/lib/authentication-providers/constants')
  .authenticationProviders;

/**
 * Function to remove impl information from authentication provider config or authentication provider type configuration as that is not useful on the client side \
 * and should not be transmitted
 *
 * @param authConfigOrTypeConfig Authentication provider config or authentication provider type configuration
 * @returns {{impl}}
 */
const sanitize = authConfigOrTypeConfig => {
  const sanitizeOne = config => {
    if (_.get(config, 'config.impl')) {
      // When the auth provider type config is passed the impl is at 'config.impl' path
      delete config.config.impl;
    } else if (_.get(config, 'type.config.impl')) {
      // When the auth provider config is passed the impl is at 'type.config.impl' path
      delete config.type.config.impl;
    }
    return config;
  };
  return _.isArray(authConfigOrTypeConfig)
    ? _.map(authConfigOrTypeConfig, sanitizeOne)
    : sanitizeOne(authConfigOrTypeConfig);
};

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const settings = context.settings;
  const boom = context.boom;
  const invoke = newInvoker(context.service.bind(context));

  const [authenticationProviderTypeService, authenticationProviderConfigService] = await context.service([
    'authenticationProviderTypeService',
    'authenticationProviderConfigService',
  ]);

  const saveAuthenticationProvider = async (res, req, action) => {
    const requestContext = res.locals.requestContext;
    const { providerTypeId, providerConfig } = req.body;

    // Make sure the current user is an admin user
    // Only admins are allowed to add authentication providers
    await ensureAdmin(requestContext);

    if (!providerTypeId) {
      throw boom.badRequest('Missing providerTypeId in the request', true);
    }
    if (!providerConfig) {
      throw boom.badRequest('Missing providerConfig in the request', true);
    }
    if (!providerConfig.id) {
      throw boom.badRequest('Missing id in the providerConfig', true);
    }

    const providerTypeConfig = await authenticationProviderTypeService.getAuthenticationProviderType(
      requestContext,
      providerTypeId,
    );

    if (_.isEmpty(providerTypeConfig)) {
      throw boom.badRequest(
        `Invalid providerTypeId specified. No authentication provider type with id = "${providerTypeId}" found`,
        true,
      );
    }

    const provisionerLocator = _.get(providerTypeConfig, 'config.impl.provisionerLocator');
    const result = await invoke(provisionerLocator, {
      providerTypeConfig,
      providerConfig,
      action,
    });

    res.status(200).json(sanitize(result));
  };

  // ===============================================================
  //  GET /configs (mounted to /api/authentication/provider)
  // ===============================================================
  router.get(
    '/configs',
    wrap(async (req, res) => {
      const result = await authenticationProviderConfigService.getAuthenticationProviderConfigs();
      res.status(200).json(sanitize(result));
    }),
  );

  // ===============================================================
  //  PUT /configs (mounted to /api/authentication/provider)
  // ===============================================================
  router.put(
    '/configs',
    wrap(async (req, res) => {
      await saveAuthenticationProvider(res, req, authProviderConstants.provisioningAction.update);
    }),
  );

  // ===============================================================
  //  GET /types (mounted to /api/authentication/provider)
  // ===============================================================
  router.get(
    '/types',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const result = await authenticationProviderTypeService.getAuthenticationProviderTypes(requestContext);
      res.status(200).json(sanitize(result));
    }),
  );

  return router;
}

module.exports = configure;
