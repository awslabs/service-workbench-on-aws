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

import { types } from 'mobx-state-tree';
import { sessionStore, uiEventBus } from '@amzn/base-ui/dist/models/SessionStore';

const WorkflowCommonUIState = types
  .model('WorkflowCommonUIState', {
    versionNumber: -1,
    mainTabIndex: 0,
  })
  .actions(self => ({
    setVersionNumber(v) {
      self.versionNumber = v;
    },
    setMainTabIndex(index) {
      self.mainTabIndex = index;
    },
  }));

function getUIState(idSuffix) {
  const id = `WorkflowCommonUIState-${idSuffix}`;
  const entry = sessionStore.map.get(id) || WorkflowCommonUIState.create();

  sessionStore.map.set(id, entry);
  return entry;
}

uiEventBus.listenTo('workflowTemplatePublished', {
  id: 'WorkflowCommonUIState',
  listener: async event => {
    sessionStore.removeStartsWith(`WorkflowCommonUIState-${event.id}`);
  },
});

uiEventBus.listenTo('workflowPublished', {
  id: 'WorkflowCommonUIState',
  listener: async event => {
    sessionStore.removeStartsWith(`WorkflowCommonUIState-${event.id}`);
  },
});

export default getUIState;
