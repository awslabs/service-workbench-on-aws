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
const axios = require('axios').default;

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
      const { code, mainUrl } = req.body;

      const providers = await authenticationProviderConfigService.getAuthenticationProviderConfigs();
      const cognitoAuthConfig = _.find(providers, provider => {
        return provider.config.type.type === 'cognito_user_pool';
      });

      const params = {
        code,
        grant_type: 'authorization_code',
        client_id: cognitoAuthConfig.config.clientId,
        redirect_uri: mainUrl,
      };

      const authCodeTokenExchangeUri = cognitoAuthConfig.config.authCodeTokenExchangeUri;

      // Make a POST request to exchange code for token
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

      try {
        const axiosClient = axios.create({
          baseURL: authCodeTokenExchangeUri,
          headers,
        });

        const response = await axiosClient.post(authCodeTokenExchangeUri, params, { params });
        res.status(200).json({ token: _.get(response, 'data.id_token') });
      } catch (e) {
        throw boom.badRequest(`Error received while  call: ${e}`, true);
      }
    }),
  );

  return router;
}

module.exports = configure;
