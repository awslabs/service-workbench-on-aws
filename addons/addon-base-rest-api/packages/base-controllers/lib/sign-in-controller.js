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

// const _ = require('lodash');
// const { newInvoker } = require('@aws-ee/base-api-services/lib/authentication-providers/helpers/invoker');

async function configure(context) {
  const router = context.router();
  // const wrap = context.wrap;
  // const settings = context.settings;
  // const boom = context.boom;

  // const authenticationProviderConfigService = await context.service('authenticationProviderConfigService');
  // const invoke = newInvoker(context.service.bind(context));
  // ===============================================================
  //  POST / (mounted to /api/authentication/id-tokens)
  // ===============================================================
  // router.post(
  //   '/',
  //   wrap(async (req, res) => {
  //     const { username, password, authenticationProviderId } = req.body;

  //     const authProviderConfig = await authenticationProviderConfigService.getAuthenticationProviderConfig(
  //       authenticationProviderId,
  //     );
  //     // Provider type is pulled from DDB and then the auth service is invoked
  //     const tokenIssuerLocator = _.get(authProviderConfig, 'config.type.config.impl.tokenIssuerLocator');
  //     const idToken = await invoke(tokenIssuerLocator, { username, password }, authProviderConfig);
  //     res.status(200).json({ idToken });
  //   }),
  // );

  return router;
}

module.exports = configure;
