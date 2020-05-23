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

const inputManifestForUpdate = {
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
            'This is a required field. This is used for uniquely identifying the authentication provider. ' +
            'This must be same as the Cognito User Pool Provider URL in ' +
            '"https://cognito-idp.{aws-region}.amazonaws.com/{user-pool-id}" format',
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
      // TODO: Add support for array input types in input manifest
      //  this is required for allowing to dynamically configure multiple federatedIdentityProviders
      // The children in the input manifest sections tree are all expected to be flat key,value pairs
      // The names below are based on object path
      // For example, the authentication providers create API expects structure to be
      // {
      //  ...
      //  federatedIdentityProviders: [
      //    {
      //        id, // This is named federatedIdentityProviders_0_id below as this is the "id" of the first element (i.e., at "0" index) in the array "federatedIdentityProviders"
      //        name,
      //        displayName,
      //        metadata
      //    }
      //  ]
      // }
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

module.exports = { inputManifestForUpdate };
