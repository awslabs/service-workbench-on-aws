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

const cognitoAuthType = require('@aws-ee/base-api-services/lib/authentication-providers/built-in-providers/cogito-user-pool/type')
  .type;

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const settings = context.settings;
  // const boom = context.boom;

  const authenticationProviderConfigService = await context.service('authenticationProviderConfigService');

  // ===============================================================
  //  GET / (mounted to /api/authentication/public/provider/configs)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const providers = await authenticationProviderConfigService.getAuthenticationProviderConfigs();

      // Construct/filter results based on info that's needed client-side
      const result = [];
      providers.forEach(provider => {
        const basePublicInfo = {
          id: provider.config.id,
          title: provider.config.title,
          type: provider.config.type.type,
          credentialHandlingType: provider.config.type.config.credentialHandlingType,
          signInUri: provider.config.signInUri,
          signOutUri: provider.config.signOutUri,
        };

        if (provider.config.type.type !== cognitoAuthType) {
          // For non-Cognito providers, just return their info as-is
          result.push(basePublicInfo);
        } else {
          // If native users are enabled for a Cognito user pool, add the pool's info
          // NOTE: The pool info is still needed by the frontend even if native users
          //       are disabled. When a user is federated by Cognito, the JWT issuer
          //       is defined as the user pool itself. The frontend uses the JWT issuer
          //       to determine which provider was used so that it can facilitate logout.
          const cognitoPublicInfo = {
            ...basePublicInfo,
            userPoolId: provider.config.userPoolId,
            clientId: provider.config.clientId,
            enableNativeUserPoolUsers: provider.config.enableNativeUserPoolUsers,
          };

          if (cognitoPublicInfo.enableNativeUserPoolUsers) {
            cognitoPublicInfo.signInUri = `${basePublicInfo.signInUri}&identity_provider=COGNITO`;
          } else {
            delete cognitoPublicInfo.signInUri;
          }

          result.push(cognitoPublicInfo);

          // Add IdPs federating via Cognito as their own entries
          provider.config.federatedIdentityProviders.forEach(idp => {
            result.push({
              ...basePublicInfo,
              id: idp.id,
              title: idp.displayName,
              type: 'cognito_user_pool_federated_idp',
              signInUri: `${basePublicInfo.signInUri}&idp_identifier=${idp.id}`,
            });
          });
        }
      });
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
