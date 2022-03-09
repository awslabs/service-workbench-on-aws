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

import fetch from 'node-fetch';
import _ from 'lodash';

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

  const authenticationProviderConfigService = await context.service('authenticationProviderConfigService');
  // ===============================================================
  //  POST / (mounted to /api/authentication/id-tokens)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const { code, pkce, mainUrl } = req.body;

      const providers = await authenticationProviderConfigService.getAuthenticationProviderConfigs();
      const cognitoAuthConfig = _.find(providers, provider => {
        return provider.config.type.type === 'cognito_user_pool';
      });

      const params = {
        code,
        grant_type: 'authorization_code',
        client_id: cognitoAuthConfig.config.clientId,
        redirect_uri: mainUrl,
        code_verifier: pkce,
      };

      const authCodeTokenExchangeUri = cognitoAuthConfig.config.authCodeTokenExchangeUri;

      // Make a POST request to exchange code for token
      const url = new URL(authCodeTokenExchangeUri);
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

      // TODO: Use axios instead of node-fetch
      try {
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(params) }).then(result => {
          return result.json();
        });

        res.status(200).json({ token: _.get(response, 'id_token') });
      } catch (e) {
        throw boom.badRequest(`Error received while  call: ${e}`, true);
      }
    }),
  );

  return router;
}

module.exports = configure;
