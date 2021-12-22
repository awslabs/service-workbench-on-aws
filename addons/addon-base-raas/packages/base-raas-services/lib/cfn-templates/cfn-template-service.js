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
const { yamlParse } = require('yaml-cfn');
const YAML = require('yaml');

const settingKeys = {
  isAppStreamEnabled: 'isAppStreamEnabled',
};

class CfnTemplateService extends Service {
  constructor() {
    super();
    this.dependency(['pluginRegistryService']);
  }

  async init() {
    await super.init();
    this.store = []; // an array of objects of this shape: { key: <name>, value: { yaml } }
    const registry = await this.service('pluginRegistryService');
    // We loop through each plugin and ask it to register its cfn templates
    const plugins = await registry.getPlugins('cfn-templates');
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of plugins) {
      // eslint-disable-next-line no-await-in-loop
      await plugin.registerCfnTemplates(this);
    }
  }

  async add({ name, yaml }) {
    const existing = await this.getTemplate(name);
    if (existing)
      throw this.boom.badRequest(
        `You tried to register a cfn template, but a cfn template with the same name "${name}" already exists`,
        true,
      );

    this.store.push({ key: name, value: yaml });
  }

  async getTemplate(name) {
    const entry = _.find(this.store, ['key', name]);
    const isAppStreamEnabled = await this.settings.getBoolean(settingKeys.isAppStreamEnabled);
    if (!isAppStreamEnabled && name === 'onboard-account' && entry) {
      const doc = yamlParse(entry.value);
      delete doc.Resources.AppStreamFleet;
      delete doc.Resources.AppStreamStack;
      delete doc.Resources.AppStreamStackFleetAssociation;
      delete doc.Outputs.AppStreamFleet;
      delete doc.Outputs.AppStreamStack;

      const onboardYaml = new YAML.Document();
      onboardYaml.contents = doc;
      return onboardYaml.toString();
    }
    return entry ? entry.value : undefined;
  }
}

module.exports = CfnTemplateService;
