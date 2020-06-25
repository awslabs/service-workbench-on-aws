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
  });
});
