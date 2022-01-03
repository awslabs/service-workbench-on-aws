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
const fs = require('fs');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

const { yamlParse } = require('yaml-cfn');
const CfnTemplateService = require('../cfn-templates/cfn-template-service');

describe('cfn-template-service', () => {
  let service = null;
  let onboardAccount = null;
  let settings = null;

  beforeEach(async () => {
    const pluginRegistryService = {
      getPlugins: jest.fn(() => {
        return [];
      }),
      initService: jest.fn(),
    };

    const container = new ServicesContainer();
    container.register('settings', new SettingsServiceMock());
    container.register('cfnTemplateService', new CfnTemplateService());
    container.register('pluginRegistryService', pluginRegistryService);
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('cfnTemplateService');
    settings = await container.find('settings');

    // Grab cfn template for testing
    onboardAccount = fs.readFileSync('./lib/__tests__/test-cfn-template.yml', 'utf8');
  });

  describe('getTemplate', () => {
    it('should remove AppStream resources if AppStream is not enabled', async () => {
      // BUILD
      // Disable AppStream
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        throw new Error(`Unexpected setting: ${key}`);
      });

      await service.add({ name: 'onboard-account', yaml: onboardAccount });

      // OPERATE
      const updatedTemplate = await service.getTemplate('onboard-account');

      // CHECK
      expect(updatedTemplate).toBeDefined();

      const parsedYaml = yamlParse(updatedTemplate);
      expect(parsedYaml.Resources.PolicyCfnStatus).toBeDefined();
      expect(parsedYaml.Outputs.CrossAccountEnvMgmtRoleArn).toBeDefined();
      // Only 1 policy, because policy with IF statement for AppStream was removed
      expect(parsedYaml.Resources.CrossAccountRoleEnvMgmt.Properties.Policies.length).toEqual(1);
      expect(
        parsedYaml.Resources.CrossAccountEnvMgmtPermissionsBoundary.Properties.PolicyDocument.Statement.length,
      ).toEqual(1);

      // AppStream resources and outputs should not be defined
      expect(parsedYaml.Resources.Route53HostedZone).toBeUndefined();
      expect(parsedYaml.Resources.AppStreamFleet).toBeUndefined();
      expect(parsedYaml.Resources.AppStreamStack).toBeUndefined();
      expect(parsedYaml.Resources.AppStreamStackFleetAssociation).toBeUndefined();
      expect(parsedYaml.Outputs.AppStreamFleet).toBeUndefined();
      expect(parsedYaml.Outputs.AppStreamStack).toBeUndefined();
    });

    it('should NOT remove AppStream resources if AppStream is enabled', async () => {
      // BUILD
      // Enable AppStream
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return true;
        }
        throw new Error(`Unexpected setting: ${key}`);
      });

      // OPERATE
      await service.add({ name: 'onboard-account', yaml: onboardAccount });

      // CHECK
      const updatedTemplate = await service.getTemplate('onboard-account');
      expect(updatedTemplate).toBeDefined();
      expect(updatedTemplate).toEqual(onboardAccount);

      // All resources should be available
      const parsedYaml = yamlParse(updatedTemplate);
      expect(parsedYaml.Resources.CrossAccountRoleEnvMgmt.Properties.Policies.length).toEqual(2);
      expect(
        parsedYaml.Resources.CrossAccountEnvMgmtPermissionsBoundary.Properties.PolicyDocument.Statement.length,
      ).toEqual(2);
      expect(parsedYaml.Resources.PolicyCfnStatus).toBeDefined();
      expect(parsedYaml.Resources.Route53HostedZone).toBeDefined();
      expect(parsedYaml.Resources.AppStreamFleet).toBeDefined();
      expect(parsedYaml.Resources.AppStreamStack).toBeDefined();
      expect(parsedYaml.Resources.AppStreamStackFleetAssociation).toBeDefined();
      expect(parsedYaml.Outputs.CrossAccountEnvMgmtRoleArn).toBeDefined();
      expect(parsedYaml.Outputs.AppStreamFleet).toBeDefined();
      expect(parsedYaml.Outputs.AppStreamStack).toBeDefined();
    });
  });
});
