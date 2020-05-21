import { types } from 'mobx-state-tree';
import FileUploadGroup from './FileUploadGroup';

const FileUploadsStore = types
  .model('FileUploadsStore', {
    fileUploadGroups: types.map(FileUploadGroup),
  })
  .actions(self => ({
    getFileUploadGroup(resourceId) {
      let group = self.fileUploadGroups.get(resourceId);
      if (!group) {
        group = FileUploadGroup.create({ resourceId, state: 'PENDING' });
        self.fileUploadGroups.put(group);
      }
      return group;
    },
    resetFileUploadGroup(resourceId) {
      const group = FileUploadGroup.create({ resourceId, state: 'PENDING' });
      self.fileUploadGroups.put(group);
    },
  }));

function registerContextItems(appContext) {
  appContext.fileUploadsStore = FileUploadsStore.create({}, appContext);
}

export { FileUploadsStore, registerContextItems };
