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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const crypto = require('crypto');

// Mocked dependencies
jest.mock('@aws-ee/base-api-services/lib/jwt-service');
const JwtService = require('@aws-ee/base-api-services/lib/jwt-service');

jest.mock('@aws-ee/key-pair-mgmt-services/lib/key-pair/key-pair-service');
const KeyPairServiceMock = require('@aws-ee/key-pair-mgmt-services/lib/key-pair/key-pair-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryServiceMock = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('../../environment-dns-service.js');
const EnvironmentDnsServiceMock = require('../../environment-dns-service.js');

jest.mock('../environment-sc-service');
const EnvironmentSCServiceMock = require('../environment-sc-service');

jest.mock('../environment-sc-keypair-service');
const EnvironmentScKeyPairServiceMock = require('../environment-sc-keypair-service');

jest.mock('node-rsa', () =>
  jest.fn(() => ({
    importKey: jest.fn(() => ({
      exportKey: jest.fn(
        // This is a random key generated for test purposes
        () => `-----BEGIN PUBLIC KEY-----
MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBLbcdPzgSh+4OkzNse6UaG
SPI3ylo406TcNKwrsKyDMfU3mLyPCVuFCrzVheEn8PYZMNWE5mCorf2RMAiYGXOW
P35i2J59Oa04PYvml/p3kSX7K1UdtkI6MXtYdNLmt4qbhCK6tWy6Cau8zzUOmLT6
YUOSvlAqpm3Ed9LPfRDn3I+EDCfbWWWvkbk3rEUJt0dXYX6UimEDRYyvlzq+abbv
f+ECYBdiC4KtLuK0K1nqqH/whEGLEwND7DAAwIICuKw5ND4wuJGPaANwXDZKU4ZO
rEYx9BfKHzYz7SZ07igvEYAJvyaLlMslBonxu+e0wlolbWeUjKUxJdXxCChbT8xB
AgMBAAE=
-----END PUBLIC KEY-----`,
      ),
    })),
  })),
);

const EnvironmentScConnectionService = require('../environment-sc-connection-service');

describe('EnvironmentScConnectionService', () => {
  let service = null;
  let envDnsService = null;
  let jwtService = null;

  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('jwtService', new JwtService());
    container.register('log', new Logger());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('pluginRegistryService', new PluginRegistryServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('environmentDnsService', new EnvironmentDnsServiceMock());
    container.register('keyPairService', new KeyPairServiceMock());
    container.register('environmentScKeypairService', new EnvironmentScKeyPairServiceMock());
    container.register('environmentScService', new EnvironmentSCServiceMock());
    container.register('environmentScConnectionService', new EnvironmentScConnectionService());
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('environmentScConnectionService');

    envDnsService = await container.find('environmentDnsService');
    jwtService = await container.find('jwtService');
  });

  describe('create connection', () => {
    it('should return connection if exists', async () => {
      // BUILD
      const connection = { url: 'www.example.com', info: 'An already existing connection' };
      service.mustFindConnection = jest.fn(() => connection);

      // OPERATE
      const retConn = await service.createConnectionUrl();

      // CHECK
      expect(retConn).toBe(connection);
    });

    it('should get RStudio connection URL for RStudio connection types', async () => {
      // BUILD
      const connection = { type: 'RStudio' };
      service.mustFindConnection = jest.fn(() => connection);
      service.getRStudioUrl = jest.fn();

      // OPERATE
      await service.createConnectionUrl();

      // CHECK
      expect(service.getRStudioUrl).toHaveBeenCalled();
    });

    it('should NOT get RStudio connection URL for non-RStudio connection types', async () => {
      // BUILD
      const connection = { type: 'nonRStudio' };
      service.mustFindConnection = jest.fn(() => connection);
      service.getRStudioUrl = jest.fn();

      // OPERATE
      await service.createConnectionUrl();

      // CHECK
      expect(service.getRStudioUrl).not.toHaveBeenCalled();
    });

    it('should get RStudio auth URL correctly', async () => {
      // BUILD
      const requestContext = 'sampleContext';
      const id = 'exampleId';
      const connection = { instanceId: 'RStudioInstanceId' };
      envDnsService.getHostname = jest.fn(() => `rstudio-${id}.example.com`);
      service.mustFindConnection = jest.fn(() => connection);
      service.getRstudioPublicKey = jest.fn(() => `0001:SAMPLEPUBLICKEY`);

      // OPERATE
      const authUrl = await service.getRStudioUrl(requestContext, id, connection);

      // CHECK
      expect(authUrl).toContain(`https://rstudio-${id}.example.com/auth-do-sign-in?v=`);
    });
  });
  describe('sendSshPublicKey ', () => {
    it('should fail invalid keyPairId', async () => {
      // BUILD
      const sshConnectionInfo = { keyPairId: '<script>', instanceOsUser: 'hacker' };

      // OPERATE and CHECK
      await expect(service.sendSshPublicKey({}, 'envId', 'connectionId', sshConnectionInfo)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail invalid instanceOsUser', async () => {
      // BUILD
      const sshConnectionInfo = { keyPairId: 'keyPairId', instanceOsUser: '<hacker>' };

      // OPERATE and CHECK
      await expect(service.sendSshPublicKey({}, 'envId', 'connectionId', sshConnectionInfo)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });

  describe('RStudio credential encryption', () => {
    it('should pass', async () => {
      // BUILD
      const connection = { type: 'RStudio', instanceId: 'sampleInstanceId' };
      service.mustFindConnection = jest.fn(() => connection);
      service.getRstudioPublicKey = jest.fn().mockResolvedValue('123:SAMPLEPUBLICKEYHASH');
      envDnsService.getHostname = jest.fn(() => `rstudio-${connection.instanceId}.example.com`);
      jwtService.getSecret = jest.fn(() => 'sampleSecretString');
      const credentials = `rstudio-user\nfcc91a0d7cfdef9fea2854f2b8b2c80355c391ca617e08567e6584efe6833948`;

      // This is a random key generated for test purposes
      const privateKeyBuffer = `-----BEGIN RSA PRIVATE KEY-----
MIIEoQIBAAKCAQBLbcdPzgSh+4OkzNse6UaGSPI3ylo406TcNKwrsKyDMfU3mLyP
CVuFCrzVheEn8PYZMNWE5mCorf2RMAiYGXOWP35i2J59Oa04PYvml/p3kSX7K1Ud
tkI6MXtYdNLmt4qbhCK6tWy6Cau8zzUOmLT6YUOSvlAqpm3Ed9LPfRDn3I+EDCfb
WWWvkbk3rEUJt0dXYX6UimEDRYyvlzq+abbvf+ECYBdiC4KtLuK0K1nqqH/whEGL
EwND7DAAwIICuKw5ND4wuJGPaANwXDZKU4ZOrEYx9BfKHzYz7SZ07igvEYAJvyaL
lMslBonxu+e0wlolbWeUjKUxJdXxCChbT8xBAgMBAAECggEAQlu51QOyH69eCUYQ
IAmp+cmDDoH/Da9kgjX0ohs0KddxnA/LEytwUIM5zb+SbckXOOI1dk4XC07GnUxc
wzLg9XW2gs9/3zs2oRvEUIGz4CzZ9TYSE6mcagXONevQ/xjJ4DdHNmsV1DVd2SWR
z92Ymg2nnRnA/USdnRKta8zjapczJpwzUc77z/+Bg96UhoOTWOB4pFBsXhn9ZPpY
XDM8pTt7TjGgyHiHJM6v5585cnGmi+A3OtqWPrdv4BfBSo2UFEAnKzwb/d2OryXm
6m3yX+CqDFrL6hHBPx+GVyrjh2qy2z9HHmyMegCN7Kc/bk7nBpPuYd//yMcGaZSv
ICjqgQKBgQCPwQx4WZVwMSYdgY7ojts/3s4ppP9Gvfnm5aTVc3REEY5ERXG113ug
VCbT1h8BgF0nWx5S2bX7QBKzwVWEyCqaVoaHJXNlXBtdCK8VaxKCHb/ZNLpxjD57
IEBA7WsFH6tZ+IQHXeOy/17pwXzwKggXcLxSqTGj1cqLgNR1xrTVzQKBgQCGUzeN
M9J2TC3LgfgrQrxfJxLGQxWGZzmxqE9CaulnP9/rn21EQzriUveOLqY3unyuKipr
v6uZU2QzgLULWxjkX/parKCtoVYvWmgVihana3v1J4tz/k46M+O3f/nxWyNApWpI
f+gaf3cRnpY5VnKykp0q/NbJ57SYHr0N4i7cRQKBgEJMRUUIA8yfTjXTd6Y3pFRb
nHdGWlk06pkblh6/RYLTGerQoDW+MIzr4pBWMyyNF+k7s8uADtbWYQm4A4neiw9t
ElQn6IV5qkEI7T6SiBGsSLuS/t25UWOVpyyKko3lYjB3VeTT31zBO/PQwZ89s0ek
PaZd07/8rJIUE2hSATqNAoGABLhh6F1c1PliVpdvoB2NPw7BcyQiWoHAHkUa2+uj
3hP5i28jyNVP+WoO9vkesDCmdvxWV0j5/75VdBXextJhsozI4GzWjKNxwuI7bB5Z
I3L8fSXxmZbjKtpt8yHVJ60bNQdbD8cm4d9+0KixALzP9QR/72XJKnkw+HOEEzvS
h70CgYAbEsXprYGR6z+a89J3h2CHfQpASHin1U4Sn0hxLBFgpZ50ubiYlC88GHRi
2CHcNtAJtZ2xpIR+94dmpRIXHSd2v2SawzBXUIDw7pvgYI5moqaBXmXYY5ZZHZrI
jM0re//6SUWx/9VfBLN+6Ul8wcqGR2uCmK/PJpzWYxz0IzhnyA==
-----END RSA PRIVATE KEY-----`;

      // OPERATE
      const result = await service.createConnectionUrl();

      // CHECK
      const encodedCreds = result.url.split('?v=')[1];
      const decodedCreds = decodeURIComponent(encodedCreds);
      const credBuff = Buffer.from(decodedCreds, 'base64');
      const decryptedCreds = crypto.privateDecrypt(
        { key: privateKeyBuffer, padding: crypto.constants.RSA_PKCS1_PADDING },
        credBuff,
      );
      expect(decryptedCreds.toString('utf8')).toBe(credentials);
    });
  });
});
