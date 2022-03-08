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

/**
 * This file contains a collection of methods to help with generating the authentication providers
 * configuration data for testing purposes.
 */

const _ = require('lodash');

const inputManifestForCreateCognito = {
  sections: [
    {
      title: 'General Information',
      children: [
        {
          name: 'id',
          type: 'stringInput',
          title: 'ID',
          rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
          desc:
            'This is a required field. This is used for uniquely identifying the authentication provider. It must be between 2 to 64 characters long and must start with an alphabet and may contain alpha numeric characters, underscores, and dashes. No other special symbols are allowed.',
        },
        {
          name: 'title',
          type: 'stringInput',
          title: 'Title',
          rules: 'required|between:3,255',
          desc: 'This is a required field and must be between 3 and 255 characters long.',
        },
      ],
    },
    {
      title: 'Congito User Pool Information',
      children: [
        {
          name: 'connectExistingCognitoUserPool',
          type: 'yesNoInput',
          title: 'Connect to Existing or Create New',
          yesLabel: 'Connect to Existing',
          noLabel: 'Create New',
          rules: 'required|boolean',
          desc: 'Do you want to connect to an existing cognito user pool or create a new one?',
        },
        {
          name: 'configureFedIdps',
          type: 'yesNoInput',
          title: 'Identity Federation',
          yesLabel: 'yes',
          noLabel: 'no',
          rules: 'required|boolean',
          desc: 'Do you want to configure SAML identity federation with other SAML identity providers?',
        },
      ],
    },
    {
      title: 'Existing Cognito User Pool Information (Optional)',
      condition: '<%= connectExistingCognitoUserPool === true %>',
      children: [
        {
          name: 'userPoolId',
          type: 'stringInput',
          title: 'Cognito User Pool ID',
          rules: 'required|string',
          desc: 'Enter the ID of the cognito user pool you want to connect to.',
        },
        {
          name: 'userPoolName',
          type: 'stringInput',
          title: 'Cognito User Pool Name',
          desc: 'Enter name of the cognito user pool you want to connect to.',
        },
      ],
    },
    {
      title: 'Configure Identity Federation (Optional)',
      condition: '<%= configureFedIdps === true %>',
      children: [
        {
          name: 'federatedIdentityProviders[0].id',
          type: 'stringInput',
          title: 'Identity Provider ID (IdP Id)',
          rules: 'required|string',
          desc:
            'An identifier for the federated identity provider. This will be used for identifying the IdP. Usually this is configured to be same as the domain name of the IdP (E.g., amazonaws.com).',
        },
        {
          name: 'federatedIdentityProviders[0].name',
          type: 'stringInput',
          title: 'Identity Provider Name',
          rules: 'required|string',
          desc: 'Name for the identity provider.',
        },
        {
          name: 'federatedIdentityProviders[0].displayName',
          type: 'stringInput',
          title: 'Identity Provider Display Name',
          desc: 'Optional display name for the identity provider.',
        },
        {
          name: 'federatedIdentityProviders[0].metadata',
          type: 'textAreaInput',
          title: 'Identity Provider SAML Metadata XML',
          desc: 'Enter identity provider SAML metadata XML document for setting up trust.',
        },
      ],
    },
  ],
};

const inputManifestForUpdateCognito = {
  sections: [
    {
      title: 'General Information',
      children: [
        {
          name: 'id',
          type: 'stringInput',
          title: 'ID',
          rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
          desc:
            'This is a required field. This is used for uniquely identifying the authentication provider. This must be same as the Cognito User Pool Provider URL in "https://cognito-idp.{aws-region}.amazonaws.com/{user-pool-id}" format',
        },
        {
          name: 'title',
          type: 'stringInput',
          title: 'Title',
          rules: 'required|between:3,255',
          desc: 'This is a required field and must be between 3 and 255 characters long.',
        },
      ],
    },
    {
      title: 'Existing Cognito User Pool Information (Optional)',
      children: [
        {
          name: 'userPoolId',
          type: 'stringInput',
          title: 'Cognito User Pool ID',
          desc: 'Enter the ID of the cognito user pool you want to connect to.',
        },
        {
          name: 'userPoolName',
          type: 'stringInput',
          title: 'Cognito User Pool Name',
          desc: 'Enter name of the cognito user pool you want to connect to.',
        },
      ],
    },
    {
      title: 'Configure Identity Federation (Optional)',
      children: [
        {
          name: 'federatedIdentityProviders|-0-|/id',
          type: 'stringInput',
          title: 'Identity Provider ID (IdP Id)',
          desc:
            'An identifier for the federated identity provider. This will be used for identifying the IdP. Usually this is configured to be same as the domain name of the IdP (E.g., amazonaws.com).',
        },
        {
          name: 'federatedIdentityProviders|-0-|/name',
          type: 'stringInput',
          title: 'Identity Provider Name',
          desc: 'Name for the identity provider.',
        },
        {
          name: 'federatedIdentityProviders|-0-|/displayName',
          type: 'stringInput',
          title: 'Identity Provider Display Name',
          desc: 'Optional display name for the identity provider.',
        },
        {
          name: 'federatedIdentityProviders|-0-|/metadata',
          type: 'textAreaInput',
          title: 'Identity Provider SAML Metadata XML',
          desc: 'Enter identity provider SAML metadata XML document for setting up trust.',
        },
      ],
    },
  ],
};

const cognitoType = {
  type: 'cognito_user_pool',
  title: 'Cognito User Pool',
  description: 'Authentication provider for Amazon Cognito User Pool',
  config: {
    credentialHandlingType: 'redirect',
    inputSchema: {
      definitions: {},
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'http://example.com/root.json',
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        id: { $id: '#/properties/id', type: 'string' },
        title: { $id: '#/properties/title', type: 'string' },
        userPoolName: { $id: '#/properties/userPoolName', type: 'string' },
        userPoolId: { $id: '#/properties/userPoolId', type: 'string' },
        clientName: { $id: '#/properties/clientName', type: 'string' },
        clientId: { $id: '#/properties/clientId', type: 'string' },
        userPoolDomain: { $id: '#/properties/userPoolDomain', type: 'string' },
        signInUri: { $id: '#/properties/signInUri', type: 'string' },
        signOutUri: { $id: '#/properties/signOutUri', type: 'string' },
        enableNativeUserPoolUsers: {
          $id: '#/properties/enableNativeUserPoolUsers',
          type: 'boolean',
        },
        federatedIdentityProviders: {
          $id: '#/properties/providerConfig/properties/federatedIdentityProviders',
          type: 'array',
          items: {
            $id: '#/properties/providerConfig/properties/federatedIdentityProviders/items',
            type: 'object',
            title: 'The Items Schema',
            required: ['id', 'name', 'metadata'],
            properties: {
              id: {
                $id: '#/properties/federatedIdentityProviders/properties/id',
                type: 'string',
              },
              name: {
                $id: '#/properties/federatedIdentityProviders/properties/name',
                type: 'string',
              },
              displayName: {
                $id: '#/properties/federatedIdentityProviders/properties/displayName',
                type: 'string',
              },
              metadata: {
                $id: '#/properties/federatedIdentityProviders/properties/metadata',
                type: 'string',
              },
            },
          },
        },
      },
    },
    inputManifestForCreate: inputManifestForCreateCognito,
    inputManifestForUpdate: inputManifestForUpdateCognito,
    impl: {
      tokenValidatorLocator: 'locator:service:cognitoUserPoolAuthenticationProviderService/validateToken',
      tokenRevokerLocator: 'locator:service:cognitoUserPoolAuthenticationProviderService/revokeToken',
      provisionerLocator: 'locator:service:cognitoUserPoolAuthenticationProvisionerService/provision',
    },
  },
};

const configurations = [
  {
    createdAt: '2020-02-14T22:34:22.185Z',
    id: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId1',
    config: {
      title: 'Login using Active Directory',
      userPoolName: 'test-raas-userPool1',
      clientName: 'test-raas-client1',
      userPoolDomain: 'test-raas1',
      enableNativeUserPoolUsers: false,
      federatedIdentityProviders: [
        {
          id: 'datalake.example.com',
          name: 'DataLake',
          displayName: 'Login using Active Directory',
          metadata: 's3://1234567890-test-va-raas-artifacts/saml-metadata/datalake-demo-idp-metadata.xml',
        },
      ],
      userPoolId: 'us-east-1_poolId1',
      id: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId1',
      clientId: '199999999991',
      signInUri:
        'https://test-raas1.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=token&client_id=199999999991&redirect_uri=https://12345.cloudfront.net',
      signOutUri:
        'https://test-raas1.auth.us-east-1.amazoncognito.com/logout?client_id=199999999991&logout_uri=https://12345.cloudfront.net',
      type: cognitoType,
    },
    updatedAt: '2020-06-23T03:29:09.335Z',
    status: 'active',
  },
  {
    createdAt: '2020-02-14T22:34:23.509Z',
    id: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId2',
    config: {
      title: 'Login using Active Directory 2',
      userPoolName: 'test-raas-userPool2',
      clientName: 'test-raas-client2',
      userPoolDomain: 'test-raas2',
      enableNativeUserPoolUsers: false,
      federatedIdentityProviders: [
        {
          id: 'datalake2.example.com',
          name: 'DataLake2',
          displayName: 'Login using Active Directory 2',
          metadata: 's3://1234567890-test-va-raas-artifacts/saml-metadata/datalake2-demo-idp-metadata.xml',
        },
      ],
      userPoolId: 'us-east-1_poolId2',
      id: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId2',
      clientId: '28888888888882',
      signInUri:
        'https://test-raas2.auth.us-east-1.amazoncognito.com/login?response_type=token&client_id=28888888888882&redirect_uri=https://12345.cloudfront.net',
      signOutUri:
        'https://test-raas2.auth.us-east-1.amazoncognito.com/logout?client_id=28888888888882&logout_uri=https://12345.cloudfront.net',
      type: cognitoType,
    },
    updatedAt: '2020-02-14T22:34:23.509Z',
    status: 'active',
  },
];

const publicConfigurations = [
  {
    id: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId1',
    title: 'Login using Active Directory',
    type: 'cognito_user_pool',
    credentialHandlingType: 'redirect',
    signOutUri:
      'https://test-raas1.auth.us-east-1.amazoncognito.com/logout?client_id=199999999991&logout_uri=https://12345.cloudfront.net',
    userPoolId: 'us-east-1_poolId1',
    clientId: '199999999991',
    enableNativeUserPoolUsers: false,
  },
  {
    id: 'datalake.example.com',
    title: 'Login using Active Directory',
    type: 'cognito_user_pool_federated_idp',
    credentialHandlingType: 'redirect',
    signInUri:
      'https://test-raas1.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=token&client_id=199999999991&redirect_uri=https://12345.cloudfront.net&idp_identifier=datalake.example.com',
    signOutUri:
      'https://test-raas1.auth.us-east-1.amazoncognito.com/logout?client_id=199999999991&logout_uri=https://12345.cloudfront.net',
  },
  {
    id: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_poolId2',
    title: 'Login using Active Directory 2',
    type: 'cognito_user_pool',
    credentialHandlingType: 'redirect',
    signOutUri:
      'https://test-raas2.auth.us-east-1.amazoncognito.com/logout?client_id=28888888888882&logout_uri=https://12345.cloudfront.net',
    userPoolId: 'us-east-1_poolId2',
    clientId: '28888888888882',
    enableNativeUserPoolUsers: false,
  },
  {
    id: 'datalake2.example.com',
    title: 'Login using Active Directory 2',
    type: 'cognito_user_pool_federated_idp',
    credentialHandlingType: 'redirect',
    signInUri:
      'https://test-raas2.auth.us-east-1.amazoncognito.com/login?response_type=token&client_id=28888888888882&redirect_uri=https://12345.cloudfront.net&idp_identifier=datalake2.example.com',
    signOutUri:
      'https://test-raas2.auth.us-east-1.amazoncognito.com/logout?client_id=28888888888882&logout_uri=https://12345.cloudfront.net',
  },
];

module.exports = {
  getConfigurations: () => _.cloneDeep(configurations),
  getPublicConfigurations: () => _.cloneDeep(publicConfigurations),
  getSignInUri: configurationId => {
    const entry = _.find(configurations, ['id', configurationId]);
    if (!entry) throw new Error(`No test auth configuration data with id [${configurationId}] is found`);

    return `${entry.config.signInUri}&identity_provider=COGNITO`;
  },
};
