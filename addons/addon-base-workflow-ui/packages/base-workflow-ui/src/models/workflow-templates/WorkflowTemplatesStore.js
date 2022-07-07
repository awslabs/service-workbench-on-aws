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
import { types } from 'mobx-state-tree';
import { BaseStore } from '@amzn/base-ui/dist/models/BaseStore';
import { uiEventBus } from '@amzn/base-ui/dist/models/SessionStore';

import { getWorkflowTemplates } from '../../helpers/api';
import { WorkflowTemplate } from './WorkflowTemplate';

// ==================================================================
// WorkflowTemplatesStore
// ==================================================================
const WorkflowTemplatesStore = BaseStore.named('WorkflowTemplatesStore')
  .props({
    templates: types.optional(types.map(WorkflowTemplate), {}),
    tickPeriod: 900 * 1000, // 15 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const versions = await getWorkflowTemplates();
        const templates = toTemplates(versions);

        // we try to preserve existing template versions data and merge the new data instead
        self.runInAction(() => {
          const previousKeys = {};
          self.templates.forEach((_value, key) => {
            previousKeys[key] = true;
          });
          templates.forEach(template => {
            const id = template.id;
            const hasPrevious = self.templates.has(id);

            self.addTemplate(template);

            if (hasPrevious) {
              delete previousKeys[id];
            }
          });

          _.forEach(previousKeys, (_value, key) => {
            self.templates.delete(key);
          });
        });
      },

      addTemplate(rawTemplate) {
        const id = rawTemplate.id;
        const previous = self.templates.get(id);

        if (!previous) {
          self.templates.put(rawTemplate);
        } else {
          previous.setWorkflowTemplate(rawTemplate);
        }
      },

      cleanup: () => {
        self.templates.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.templates.size === 0;
    },

    get total() {
      return self.templates.size;
    },

    get list() {
      const result = [];
      self.templates.forEach(template => result.push(template));

      return _.reverse(_.sortBy(result, ['latest.createdAt', 'title']));
      // return result;
    },

    getTemplate(id) {
      return self.templates.get(id);
    },
  }));

// Given an array of [ { id: tmp1, v: 0, ... }, { id: tmp1, v:1, ... } ]
// return an array of the grouping of the template versions based on their ids
// [ { id, versions: [ ... ] }, { id, versions: [ ... ] }, ...]
function toTemplates(versions) {
  const map = {};
  _.forEach(versions, version => {
    const id = version.id;
    const entry = map[id] || { id, versions: [] };
    entry.versions.push(version);
    map[id] = entry;
  });

  return _.values(map);
}

function registerContextItems(appContext) {
  appContext.workflowTemplatesStore = WorkflowTemplatesStore.create({}, appContext);

  uiEventBus.listenTo('workflowTemplatePublished', {
    id: 'WorkflowTemplatesStore',
    listener: async _event => {
      appContext.workflowTemplatesStore.cleanup();
    },
  });
}

export { WorkflowTemplatesStore, registerContextItems };
