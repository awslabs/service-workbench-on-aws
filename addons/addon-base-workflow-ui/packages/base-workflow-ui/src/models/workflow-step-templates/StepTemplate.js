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

import _ from 'lodash';
import { types, applySnapshot, getEnv, getSnapshot } from 'mobx-state-tree';

import { InputManifest, applyMarkdown, visit } from '@amzn/base-ui/dist/models/forms/InputManifest';

// ==================================================================
// Helpers
// ==================================================================

// Given an input manifest we want to derive an admin input manifest from it, this is done by doing the following:
// - combining all the sections into one
// - removing all conditions in all input entries
// - removing 'required' from rules attributes
function deriveAdminInputManifest(inputManifest = {}) {
  const admin = _.cloneDeep(inputManifest);
  const visitFn = item => {
    if (_.isString(item.rules)) {
      item.rules = item.rules.replace(/\|required\|/, '');
      item.rules = item.rules.replace(/required\|/, '');
      item.rules = item.rules.replace(/\|required/, '');
      item.rules = item.rules.replace(/required/, '');
    }
    delete item.condition;
    return item;
  };
  const sections = _.map(admin.sections, (section = {}) => visit(section.children, visitFn));

  admin.sections = [{ children: _.flatten(sections) }];
  return admin;
}

// ==================================================================
// StepTemplateVersion
// ==================================================================
const StepTemplateVersion = types
  .model('StepTemplateVersion', {
    id: '',
    v: types.maybeNull(types.number),
    title: '',
    desc: '',
    skippable: types.maybe(types.boolean),
    inputManifest: types.maybe(InputManifest),
    adminInputManifest: types.maybe(InputManifest),
  })
  .actions(self => {
    function transformManifest(manifest) {
      // We now apply markdown
      const showdown = getEnv(self).showdown;
      const assets = {}; // TODO resolve the assets of the step template (assets is a map of the name
      // of the asset and the url of the asset), an asset is just an image file.
      if (manifest) {
        return applyMarkdown({ inputManifest: manifest, showdown, assets });
      }
      return manifest;
    }

    return {
      afterCreate() {
        self.inputManifest = transformManifest(self.inputManifest);
        if (self.adminInputManifest) {
          self.adminInputManifest = transformManifest(self.adminInputManifest);
        } else if (self.inputManifest) {
          self.adminInputManifest = deriveAdminInputManifest(getSnapshot(self.inputManifest));
        }
      },

      setStepTemplateVersion(template) {
        applySnapshot(self, template);
        self.afterCreate();
      },
    };
  })

  .views(_self => ({}));

// ==================================================================
// StepTemplate
// ==================================================================
const StepTemplate = types
  .model('StepTemplate', {
    id: types.identifier,
    versions: types.optional(types.array(StepTemplateVersion), []),
  })
  .actions(self => ({
    setStepTemplate(template) {
      // we try to preserve any existing version objects and update their content instead
      const mapOfExisting = _.keyBy(self.versions, version => version.v.toString());
      const processed = [];

      _.forEach(template.versions, templateVersion => {
        const existing = mapOfExisting[templateVersion.v];
        if (existing) {
          existing.setStepTemplateVersion(templateVersion);
          processed.push(existing);
        } else {
          processed.push(StepTemplateVersion.create(templateVersion));
        }
      });

      self.versions.replace(processed);
    },
  }))

  .views(self => ({
    get latest() {
      // we loop through all 'v' numbers and pick the template with the largest 'v' value
      let largestVersion = self.versions[0];
      _.forEach(self.versions, version => {
        if (version.v > largestVersion.v) {
          largestVersion = version;
        }
      });
      return largestVersion;
    },

    getVersion(v) {
      return _.find(self.versions, ['v', v]);
    },

    get versionNumbers() {
      return _.map(self.versions, version => version.v);
    },
  }));

export { StepTemplate, StepTemplateVersion };
