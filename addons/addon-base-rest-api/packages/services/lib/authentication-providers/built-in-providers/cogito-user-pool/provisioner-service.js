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
const Service = require('@aws-ee/base-services-container/lib/service');
const { generateIdSync } = require('@aws-ee/base-services/lib/helpers/utils');
const authProviderConstants = require('../../constants').authenticationProviders;

const settingKeys = {
  awsRegion: 'awsRegion',
  envName: 'envName',
  envType: 'envType',
  solutionName: 'solutionName',
  websiteUrl: 'websiteUrl',
  enableUserSignUps: 'enableUserSignUps',
  enableNativeUserPoolUsers: 'enableNativeUserPoolUsers',
  autoConfirmNativeUsers: 'autoConfirmNativeUsers',
  namespace: 'namespace',
};

class ProvisionerService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 's3Service', 'jsonSchemaValidationService', 'authenticationProviderConfigService']);
    this.boom.extend(['authProviderAlreadyExists', 400]);
    this.boom.extend(['noAuthProviderFound', 400]);
  }

  // eslint-disable-next-line no-unused-vars
  async provision({ providerTypeConfig, providerConfig, action }) {
    if (!action) {
      throw this.boom.badRequest('Can not provision Cognito User Pool. Missing required parameter "action"', false);
    }

    this.log.info('Provisioning Cognito User Pool Authentication Provider');

    // Validate input
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    const providerConfigJsonSchema = _.get(providerTypeConfig, 'config.inputSchema');
    await jsonSchemaValidationService.ensureValid(providerConfig, providerConfigJsonSchema);

    const authenticationProviderConfigService = await this.service('authenticationProviderConfigService');
    let existingProviderConfig;
    if (providerConfig.id) {
      existingProviderConfig = await authenticationProviderConfigService.getAuthenticationProviderConfig(
        providerConfig.id,
      );
    }
    if (action === authProviderConstants.provisioningAction.create && !_.isNil(existingProviderConfig)) {
      // The authentication provider with same config id already exists.
      throw this.boom.authProviderAlreadyExists(
        'Can not create the specified authentication provider. An authentication provider with the same id already exists',
        true,
      );
    }
    if (action === authProviderConstants.provisioningAction.update && _.isNil(existingProviderConfig)) {
      // The authentication provider with the specified config id does not exist.
      throw this.boom.noAuthProviderFound(
        'Can not update the specified authentication provider. No authentication provider with the specified id found',
        true,
      );
    }

    // Each provisioning step function below takes providerConfig and performs it's own provisioning work
    // and also updates (enriches) providerConfig with additional information (referred to as outputs)
    // For example, when creating Cognito User Pool, the ID of the created cognito user pool (i.e., userPoolId) is
    // added to the providerConfig.
    // The providerConfigWithOutputs variable below is the updated providerConfig with these outputs
    let providerConfigWithOutputs = providerConfig;
    providerConfigWithOutputs = await this.saveCognitoUserPool(providerConfigWithOutputs);

    if (existingProviderConfig) {
      providerConfigWithOutputs.clientId = existingProviderConfig.config.clientId;
    } else {
      providerConfigWithOutputs = await this.createUserPoolClient(providerConfigWithOutputs);
    }

    providerConfigWithOutputs = await this.createUserPoolClient(providerConfigWithOutputs);
    providerConfigWithOutputs = await this.configureCognitoIdentityProviders(providerConfigWithOutputs);
    providerConfigWithOutputs = await this.updateUserPoolClient(providerConfigWithOutputs);
    providerConfigWithOutputs = await this.configureUserPoolDomain(providerConfigWithOutputs);

    const userPoolDomain = providerConfigWithOutputs.userPoolDomain;
    const awsRegion = this.settings.get(settingKeys.awsRegion);
    const clientId = providerConfigWithOutputs.clientId;
    const websiteUrl = this.settings.get(settingKeys.websiteUrl);

    providerConfigWithOutputs.id = `https://cognito-idp.${awsRegion}.amazonaws.com/${providerConfigWithOutputs.userPoolId}`;

    const baseAuthUri = `https://${userPoolDomain}.auth.${awsRegion}.amazoncognito.com`;
    providerConfigWithOutputs.signInUri = `${baseAuthUri}/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${websiteUrl}`;
    providerConfigWithOutputs.signOutUri = `${baseAuthUri}/logout?client_id=${clientId}&logout_uri=${websiteUrl}`;

    this.log.info('Saving Cognito User Pool Authentication Provider Configuration.');

    // Save auth provider configuration and make it active
    const result = await authenticationProviderConfigService.saveAuthenticationProviderConfig({
      providerTypeConfig,
      providerConfig: providerConfigWithOutputs,
      status: authProviderConstants.status.active,
    });
    return result;
  }

  async getPreSignUpLambdaArn() {
    const aws = await this.service('aws');
    const cfnClient = new aws.sdk.CloudFormation({ apiVersion: '2010-05-15' });
    const stackDetails = await cfnClient
      .describeStacks({ StackName: `${this.settings.get(settingKeys.namespace)}-postDeployment` })
      .promise();
    const cfnData = _.get(stackDetails, 'Stacks[0]');
    const outputs = _.get(cfnData, 'Outputs', []);
    const cfnOutputsResult = {};
    _.forEach(outputs, item => {
      cfnOutputsResult[item.OutputKey] = item.OutputValue;
    });

    return cfnOutputsResult.PreSignUpLambdaArn;
  }

  /* ************** Provisioning Steps ************** */
  async saveCognitoUserPool(providerConfig) {
    this.log.info('Creating or configuring Cognito User Pool');

    const aws = await this.service('aws');
    const cognitoIdentityServiceProvider = new aws.sdk.CognitoIdentityServiceProvider();

    const envType = this.settings.get(settingKeys.envType);
    const envName = this.settings.get(settingKeys.envName);
    const solutionName = this.settings.get(settingKeys.solutionName);
    const userPoolName = providerConfig.userPoolName || `${envName}-${envType}-${solutionName}-userpool`;

    // Get PreSignUpLambdaArn output from CFN stack, get undefined if not present
    const preSignUpLambdaArn = await this.getPreSignUpLambdaArn();

    const params = {
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: !this.settings.getBoolean(settingKeys.enableUserSignUps),
      },
      LambdaConfig:
        this.settings.getBoolean(settingKeys.enableNativeUserPoolUsers) &&
        this.settings.getBoolean(settingKeys.autoConfirmNativeUsers)
          ? {
              PreSignUp: preSignUpLambdaArn,
            }
          : undefined,
      AutoVerifiedAttributes: ['email'],
      Schema: [
        {
          Name: 'name',
          Mutable: true,
          Required: true,
        },
        {
          Name: 'family_name',
          Mutable: true,
          Required: true,
        },
        {
          Name: 'middle_name',
          Mutable: true,
          Required: false,
        },
      ],
    };

    let userPoolArn;
    if (providerConfig.userPoolId) {
      // If userPoolId is specified then this must be for update so make sure it points to a valid cognito user pool
      try {
        const poolDetails = await cognitoIdentityServiceProvider
          .describeUserPool({ UserPoolId: providerConfig.userPoolId })
          .promise();
        userPoolArn = poolDetails.UserPool.Arn;

        this.log.info('Updating Cognito User Pool as per config changes, if any');
        const updateParams = {
          UserPoolId: providerConfig.userPoolId,
          AdminCreateUserConfig: {
            AllowAdminCreateUserOnly: !this.settings.getBoolean(settingKeys.enableUserSignUps),
          },
          LambdaConfig: {
            // We don't check for autoConfirmNativeUsers and enableNativeUserPoolUsers config setting values in the update cycle
            // because preSignUp lambda is created based on the same conditions, therefore this logic can set or reset the cognito trigger
            PreSignUp: preSignUpLambdaArn,
          },
        };
        await cognitoIdentityServiceProvider.updateUserPool(updateParams).promise();
      } catch (err) {
        if (err.code === 'ResourceNotFoundException') {
          throw this.boom.badRequest(
            'Can not update Cognito User Pool. No Cognito User Pool with the given userPoolId exists.',
            true,
          );
        }
        // In case of any other error, let it propagate
        throw err;
      }
    } else {
      // userPoolId is not specified so create new user pool
      params.PoolName = userPoolName;
      const data = await cognitoIdentityServiceProvider.createUserPool(params).promise();
      userPoolArn = data.UserPool.Arn;
      providerConfig.userPoolId = data.UserPool.Id;
    }

    // If PreSignUpLambdaArn is not undefined, allow it to be invoked by Cognito
    if (!_.isUndefined(preSignUpLambdaArn)) {
      const lambda = new aws.sdk.Lambda();
      const invokePermParam = {
        Action: 'lambda:InvokeFunction',
        FunctionName: preSignUpLambdaArn,
        Principal: 'cognito-idp.amazonaws.com',
        StatementId: 'CognitoLambdaInvokePermission',
        SourceArn: userPoolArn,
      };

      try {
        await lambda.addPermission(invokePermParam).promise();
      } catch (err) {
        if (err.code === 'ResourceConflictException') {
          this.log.info('Lambda invoke permission already assigned');
        } else {
          // In case of any other error, let it propagate
          throw this.boom.badRequest(
            `Adding cognito invoke permission to lambda ${preSignUpLambdaArn} failed with code: ${err.code}`,
            true,
          );
        }
      }
    }

    providerConfig.userPoolName = userPoolName;
    return providerConfig;
  }

  async createUserPoolClient(providerConfig) {
    this.log.info('Creating or configuring Cognito User Pool Client');
    if (!providerConfig.userPoolId) {
      throw this.boom.badRequest('Can not create Cognito User Pool Client. Missing userPoolId.', true);
    }
    const aws = await this.service('aws');
    const cognitoIdentityServiceProvider = new aws.sdk.CognitoIdentityServiceProvider();

    function getUrls() {
      const websiteUrl = this.settings.get(settingKeys.websiteUrl);
      const envType = this.settings.get(settingKeys.envType);
      const callbackUrls = [websiteUrl];
      const localUrl = 'http://localhost:3000';
      let defaultRedirectUri;
      if (envType === 'dev') {
        defaultRedirectUri = localUrl;
        // add localhost for callback url for local development in case of 'dev' environment
        callbackUrls.push(localUrl);
      } else {
        defaultRedirectUri = websiteUrl;
      }
      // The logout urls are same as callback urls in our case
      const logoutUrls = callbackUrls;
      return { callbackUrls, defaultRedirectUri, logoutUrls };
    }

    let isClientConfiguredAlready = false;
    if (providerConfig.clientId) {
      try {
        // If clientId is specified then make sure it exists in the given user pool
        const result = await cognitoIdentityServiceProvider
          .describeUserPoolClient({
            ClientId: providerConfig.clientId,
            UserPoolId: providerConfig.userPoolId,
          })
          .promise();

        isClientConfiguredAlready = !!result.UserPoolClient;
      } catch (e) {
        if (e.code !== 'ResourceNotFoundException') {
          // Swallow ResourceNotFoundException. In that case, the flag isClientConfiguredAlready will stay false.
          // Propagate any other exception
          throw e;
        }
      }
    }

    if (!isClientConfiguredAlready) {
      // if client is not configured for the given user pool yet then create a new one
      const { callbackUrls, defaultRedirectUri, logoutUrls } = getUrls.call(this);

      const clientName = providerConfig.clientName || 'DataLakeClient';
      const params = {
        ClientName: clientName,
        UserPoolId: providerConfig.userPoolId,
        AllowedOAuthFlows: ['implicit'],
        AllowedOAuthFlowsUserPoolClient: true,
        AllowedOAuthScopes: ['email', 'openid', 'profile'],
        CallbackURLs: callbackUrls,
        DefaultRedirectURI: defaultRedirectUri,
        ExplicitAuthFlows: ['ADMIN_NO_SRP_AUTH'],
        LogoutURLs: logoutUrls,
        // Make certain attributes readable and writable by this client.
        // See "https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html" for list of attributes Cognito supports by default
        ReadAttributes: [
          'address',
          'birthdate',
          'family_name',
          'gender',
          'given_name',
          'locale',
          'middle_name',
          'name',
          'nickname',
          'phone_number',
          'phone_number_verified',
          'picture',
          'preferred_username',
          'profile',
          'updated_at',
          'website',
          'zoneinfo',
          'email',
          'email_verified',
        ],
        WriteAttributes: ['email', 'family_name', 'given_name', 'middle_name', 'name'],
        RefreshTokenValidity: 7, // Allowing refresh token to be used for one week
      };
      const data = await cognitoIdentityServiceProvider.createUserPoolClient(params).promise();
      providerConfig.clientId = data.UserPoolClient.ClientId;
    }
    return providerConfig;
  }

  async updateUserPoolClient(providerConfig) {
    this.log.info('Updating Cognito User Pool Client');
    if (!providerConfig.userPoolId) {
      throw this.boom.badRequest('Can not update Cognito User Pool Client. Missing userPoolId.', true);
    }
    if (!providerConfig.clientId) {
      throw this.boom.badRequest('Can not update Cognito User Pool Client. Missing clientId.', true);
    }
    const aws = await this.service('aws');
    const cognitoIdentityServiceProvider = new aws.sdk.CognitoIdentityServiceProvider();

    // At this point the cognito client should have already been created.
    const result = await cognitoIdentityServiceProvider
      .describeUserPoolClient({
        ClientId: providerConfig.clientId,
        UserPoolId: providerConfig.userPoolId,
      })
      .promise();
    const existingClientConfig = result.UserPoolClient;

    let supportedIdpNames = [];
    if (!_.isEmpty(providerConfig.federatedIdentityProviders)) {
      // federatedIdentityProviders are provided so assume SAML federation
      //
      // federatedIdentityProviders -- an array of federated identity provider info objects with following shape
      // [{
      //    id: 'some-id-of-the-idp' (such as 'com.amazonaws' etc. The usual practice is to keep this same as the domain name of the idp.)
      //    name: 'some-idp-name' (such as 'com.amazonaws', 'AmazonAWSEmployees' etc)
      //    displayName: 'some-displayable-name-for-the-idp' (such as 'Internal Users', 'External Users' etc)
      //    metadata: 'SAML XML Metadata blob for the identity provider or a URI pointing to a location that will provide the SAML metadata'
      // }]
      const idpNames = _.map(providerConfig.federatedIdentityProviders, idp => idp.name);
      supportedIdpNames = idpNames;
    }

    // Enable Cognito as an auth provider for the app client if configured
    if (providerConfig.enableNativeUserPoolUsers) {
      supportedIdpNames.push('COGNITO');
    }

    const params = {
      ClientId: existingClientConfig.ClientId,
      UserPoolId: existingClientConfig.UserPoolId,
      AllowedOAuthFlows: existingClientConfig.AllowedOAuthFlows,
      AllowedOAuthFlowsUserPoolClient: existingClientConfig.AllowedOAuthFlowsUserPoolClient,
      AllowedOAuthScopes: existingClientConfig.AllowedOAuthScopes,
      CallbackURLs: existingClientConfig.CallbackURLs,
      ClientName: existingClientConfig.ClientName,
      DefaultRedirectURI: existingClientConfig.DefaultRedirectURI,
      ExplicitAuthFlows: existingClientConfig.ExplicitAuthFlows,
      LogoutURLs: existingClientConfig.LogoutURLs,
      ReadAttributes: existingClientConfig.ReadAttributes,
      RefreshTokenValidity: existingClientConfig.RefreshTokenValidity,
      WriteAttributes: existingClientConfig.WriteAttributes,
      SupportedIdentityProviders: supportedIdpNames,
    };
    // The following update call with SupportedIdentityProviders must be made only AFTER creating the identity providers (happening in "configureCognitoIdentityProviders")
    // The below call will fail without that. The idp names specified in SupportedIdentityProviders must match the ones created in "configureCognitoIdentityProviders"
    await cognitoIdentityServiceProvider.updateUserPoolClient(params).promise();
    return providerConfig;
  }

  async configureCognitoIdentityProviders(providerConfig) {
    // federatedIdentityProviders -- an array of federated identity provider info objects with following shape
    // [{
    //    id: 'some-id-of-the-idp' (such as 'com.amazonaws' etc. The usual practice is to keep this same as the domain name of the idp.
    //    For example, when connecting with an IdP that has users "user1@domain1.com", "user2@domain1.com" etc then the "id" should
    //    be set to "domain1.com")
    //
    //    name: 'some-idp-name' (such as 'com.amazonaws', 'AmazonAWSEmployees' etc)
    //
    //    displayName: 'some-displayable-name-for-the-idp' (such as 'Internal Users', 'External Users' etc)
    //
    //    metadata: 'SAML XML Metadata blob for the identity provider or a URI pointing to a location that will provide the SAML metadata'
    // }]
    if (_.isEmpty(providerConfig.federatedIdentityProviders)) {
      // No IdPs to add. Just exit.
      return providerConfig;
    }

    this.log.info('Configuring Cognito Identity Providers');
    const aws = await this.service('aws');
    const cognitoIdentityServiceProvider = new aws.sdk.CognitoIdentityServiceProvider();

    const idpCreationPromises = _.map(providerConfig.federatedIdentityProviders, async idp => {
      let metadata = idp.metadata;

      if (metadata.startsWith('s3://')) {
        const s3Service = await this.service('s3Service');
        const { s3BucketName, s3Key } = s3Service.parseS3Details(metadata);
        const result = await s3Service.api.getObject({ Bucket: s3BucketName, Key: s3Key }).promise();
        metadata = result.Body.toString('utf8');
      }

      const metaDataInfo = { IDPSignout: 'true' };
      if (/^https?:\/\//.test(metadata)) {
        metaDataInfo.MetadataURL = metadata;
      } else {
        metaDataInfo.MetadataFile = metadata;
      }

      const params = {
        ProviderDetails: metaDataInfo,
        ProviderName: idp.name /* required */,
        ProviderType: 'SAML' /* required */, // TODO: Add support for other Federation providers
        UserPoolId: providerConfig.userPoolId /* required */,
        AttributeMapping: {
          // TODO: Add support for configurable attributes mapping
          name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
          given_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          family_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        },
        IdpIdentifiers: [idp.id],
      };

      // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CognitoIdentityServiceProvider.html#createIdentityProvider-property
      try {
        await cognitoIdentityServiceProvider.createIdentityProvider(params).promise();
      } catch (err) {
        if (err.code === 'DuplicateProviderException') {
          // the identity provider already exists so update it instead of creating it
          await cognitoIdentityServiceProvider
            .updateIdentityProvider({
              ProviderName: params.ProviderName,
              UserPoolId: params.UserPoolId,
              AttributeMapping: params.AttributeMapping,
              IdpIdentifiers: params.IdpIdentifiers,
              ProviderDetails: params.ProviderDetails,
            })
            .promise();
        } else {
          // In case of any other error just rethrow
          throw err;
        }
      }
    });
    await Promise.all(idpCreationPromises);
    return providerConfig;
  }

  async configureUserPoolDomain(providerConfig) {
    this.log.info('Configuring Cognito User Pool Domain');
    const userPoolId = providerConfig.userPoolId;
    // The Domain Name Prefix for the Cogito User Pool. This will be used as a prefix to form the Fully Qualified Domain Name (FQDN)
    // for the Cognito User Pool. The Conito User Pool FQDN URL is passed to SAML IdP. The SAML IdP then returns the SAML assertion
    // back by redirecting the client to this URL.
    const envType = this.settings.get(settingKeys.envType);
    const envName = this.settings.get(settingKeys.envName);
    const solutionName = this.settings.get(settingKeys.solutionName);
    const userPoolDomain = providerConfig.userPoolDomain || `${envName}-${envType}-${solutionName}`;
    const params = {
      Domain: userPoolDomain,
      UserPoolId: userPoolId,
    };

    const aws = await this.service('aws');
    const cognitoIdentityServiceProvider = new aws.sdk.CognitoIdentityServiceProvider();

    try {
      await cognitoIdentityServiceProvider.createUserPoolDomain(params).promise();
    } catch (err) {
      if (err.code === 'InvalidParameterException' && err.message.indexOf('already exists') >= 0) {
        // The domain already exists so nothing to do. Just log and move on.
        this.log.info(`The Cognito User Pool Domain with Prefix "${userPoolDomain}" already exists. Nothing to do.`);
      } else if (
        err.code === 'InvalidParameterException' &&
        err.message.indexOf('already associated with another user pool') >= 0 &&
        // Cognito user pool domain prefix hard limit is 63, we keep it at less then 62 so the retry logic has a decent chance to succeed
        userPoolDomain.length < 62
      ) {
        await this.retryCreateDomain(cognitoIdentityServiceProvider, params, userPoolDomain, 10);
      } else {
        // Re-throw any other error, so it doesn't fail silently
        throw err;
      }
    }
    providerConfig.userPoolDomain = userPoolDomain;
    return providerConfig;
  }

  // Recursive function that retries padding different strings for cognito domain
  // Recursion ends when a valid Cognito domain is found, an error other than domin already associated is thrown, or retryCount reached
  async retryCreateDomain(cognitoIdentityServiceProvider, params, userPoolDomain, retryCount) {
    // Cognito requires domain prefix to be 63 or shorter
    params.Domain = generateIdSync(userPoolDomain)
      .substr(0, 63)
      .toLowerCase();
    try {
      await cognitoIdentityServiceProvider.createUserPoolDomain(params).promise();
    } catch (err) {
      retryCount -= 1;
      if (retryCount < 0) {
        throw err;
      } else if (
        err.code === 'InvalidParameterException' &&
        err.message.indexOf('already associated with another user pool') >= 0
      ) {
        await this.retryCreateDomain(cognitoIdentityServiceProvider, params, userPoolDomain, retryCount);
      } else {
        throw err;
      }
    }
  }
}

module.exports = ProvisionerService;
