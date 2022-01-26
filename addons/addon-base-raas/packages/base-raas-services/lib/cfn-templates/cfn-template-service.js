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
const ObjectPath = require('object-path');

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

  // Return attributesToDelete if the attribute is an "IF" statement with the condition 'isAppStreamAndCustomDomain' or 'isAppStream' and the else clause is 'AWS::NoValue'
  getResourceAttributesToDelete(doc, policiesPath) {
    const attributesToDelete = [];
    if (_.get(doc, policiesPath)) {
      const policies = _.get(doc, policiesPath);
      let index;
      for (let i = 0; i < policies.length; i += 1) {
        // If policies with condition of 'isAppStream' or 'isAppStreamAndCustomDomain'
        if (policies[i]['Fn::If'] && ['isAppStream', 'isAppStreamAndCustomDomain'].includes(policies[i]['Fn::If'][0])) {
          const elseClause = _.get(policies, `${i}.Fn::If.2.Ref`);
          if (elseClause === 'AWS::NoValue') {
            index = i;
          }
        }
      }
      if (index) {
        attributesToDelete.push(`${policiesPath}.${index}`);
      }
    }
    return attributesToDelete;
  }

  async getTemplate(name) {
    const entry = _.find(this.store, ['key', name]);
    const isAppStreamEnabled = await this.settings.getBoolean(settingKeys.isAppStreamEnabled);
    if (!isAppStreamEnabled && name === 'onboard-account' && entry) {
      const doc = yamlParse(entry.value);
      const resourcesToDelete = [];
      let resourceAttributeToDelete = [];
      Object.keys(doc.Resources).forEach(resource => {
        if (
          ['isAppStreamAndCustomDomain', 'isAppStream', 'enableFlowLogsWithAppStream'].includes(
            doc.Resources[resource].Condition && doc.Resources[resource].Condition,
          )
        ) {
          resourcesToDelete.push(resource);
        }
        resourceAttributeToDelete = resourceAttributeToDelete.concat(
          this.getResourceAttributesToDelete(doc, `Resources.${resource}.Properties.Policies`),
        );
        resourceAttributeToDelete = resourceAttributeToDelete.concat(
          this.getResourceAttributesToDelete(doc, `Resources.${resource}.Properties.PolicyDocument.Statement`),
        );
      });

      resourcesToDelete.forEach(resource => {
        delete doc.Resources[resource];
      });
      resourceAttributeToDelete.forEach(path => {
        ObjectPath.del(doc, path);
      });

      const outputsToDelete = [];
      Object.keys(doc.Outputs).forEach(output => {
        if (
          ['isAppStreamAndCustomDomain', 'isAppStream', 'enableFlowLogsWithAppStream'].includes(
            doc.Outputs[output].Condition && doc.Outputs[output].Condition,
          )
        ) {
          outputsToDelete.push(output);
        }
      });
      outputsToDelete.forEach(output => {
        delete doc.Outputs[output];
      });

      const onboardYaml = new YAML.Document();
      onboardYaml.contents = doc;
      return onboardYaml.toString();
    }
    return entry ? entry.value : undefined;
  }
}

module.exports = CfnTemplateService;
