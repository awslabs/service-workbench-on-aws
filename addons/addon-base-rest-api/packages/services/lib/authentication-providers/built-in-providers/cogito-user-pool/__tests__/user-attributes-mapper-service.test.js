const UserAttributesMapperService = require('../user-attributes-mapper-service');

describe('UserAttributeMapperService', () => {
  let service = null;
  beforeEach(() => {
    service = new UserAttributesMapperService();
  });

  describe('getUsername', () => {
    it('should map a Cognito username', () => {
      const decodedToken = {
        'cognito:username': 'johndoe@example.com',
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('johndoe@example.com');
      expect(result.usernameInIdp).toEqual('johndoe@example.com');
    });

    it('should map an ADFS username', () => {
      const decodedToken = {
        'cognito:username': 'ADFS\\123abc',
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('ADFS_123abc');
      expect(result.usernameInIdp).toEqual('123abc');
    });

    it('should map an Auth0 username', () => {
      const decodedToken = {
        'cognito:username': 'Auth0_auth0|5ef37c962da',
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('Auth0_auth0_5ef37c962da');
      expect(result.usernameInIdp).toEqual('5ef37c962da');
    });

    it('should map an Auth0+Google username', () => {
      const decodedToken = {
        'cognito:username': 'Auth0_google-oauth2|10285875304827',
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('Auth0_google-oauth2_10285875304827');
      expect(result.usernameInIdp).toEqual('10285875304827');
    });

    it('should map a Cognito username from cognito:username since identities structure is incomplete', () => {
      const decodedToken = {
        'cognito:username': 'johndoe@example.com',
        'identities': [
          {
            userId: 'johndoe_from_identities@example.com',
          },
        ],
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('johndoe@example.com');
      expect(result.usernameInIdp).toEqual('johndoe@example.com');
    });

    it('should map a Cognito username from cognito:username since there are multiple identities', () => {
      const decodedToken = {
        'cognito:username': 'johndoe@example.com',
        'identities': [
          {
            userId: 'johndoe_from_identities_1@example.com',
            providerName: 'AWS-SSO',
          },
          {
            userId: 'johndoe_from_identities_2@example.com',
            providerName: 'AWS-SSO',
          },
        ],
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('johndoe@example.com');
      expect(result.usernameInIdp).toEqual('johndoe@example.com');
    });

    it('should map a AWS SSO username from identities structure', () => {
      const decodedToken = {
        'cognito:username': 'AWS-SSO_johndoe@example.com',
        'identities': [
          {
            userId: 'johndoe@example.com',
            providerName: 'AWS-SSO',
          },
        ],
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('johndoe@example.com');
      expect(result.usernameInIdp).toEqual('johndoe@example.com');
    });

    it('should map an ADFS username from identities structure', () => {
      const decodedToken = {
        'cognito:username': 'provider_ADFS\\123abc',
        'identities': [
          {
            userId: 'ADFS\\123abc',
            providerName: 'provider',
          },
        ],
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('ADFS_123abc');
      expect(result.usernameInIdp).toEqual('123abc');
    });

    it('should map an Auth0 username from identities structure', () => {
      const decodedToken = {
        'cognito:username': 'Auth0_auth0|5ef37c962da',
        'identities': [
          {
            userId: 'auth0|5ef37c962da',
            providerName: 'Auth0',
          },
        ],
      };

      const result = service.getUsername(decodedToken);
      expect(result.username).toEqual('auth0_5ef37c962da');
      expect(result.usernameInIdp).toEqual('5ef37c962da');
    });
  });
});
