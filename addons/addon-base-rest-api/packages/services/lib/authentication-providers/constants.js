// TODO - move this to base-services in base addon
const constants = {
  authenticationProviders: {
    internalAuthProviderTypeId: 'internal',
    internalAuthProviderId: 'internal',
    cognitoAuthProviderTypeId: 'cognito_user_pool',
    status: {
      initializing: 'initializing',
      active: 'active',
      inactive: 'inactive',
    },
    provisioningAction: {
      create: 'create',
      update: 'update',
      activate: 'activate',
      deactivate: 'deactivate',
    },
  },
};

module.exports = constants;
