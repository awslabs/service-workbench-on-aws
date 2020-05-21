import { types } from 'mobx-state-tree';
import { sessionStore, uiEventBus } from '@aws-ee/base-ui/dist/models/SessionStore';

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
