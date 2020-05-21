import { types } from 'mobx-state-tree';
import uuidv4 from 'uuid/v4';

const FileUpload = types
  .model('FileUpload', {
    id: types.identifier,
    status: types.union(
      types.literal('PENDING'),
      types.literal('UPLOADING'),
      types.literal('COMPLETE'),
      types.literal('FAILED'),
    ),
    uploaded: types.maybeNull(types.number),
    error: types.maybeNull(types.string),
  })
  .volatile(() => ({
    file: undefined,
    cancel: undefined,
  }))
  .views(self => ({
    get size() {
      return self.file ? self.file.size : 0;
    },
    get name() {
      return self.file ? self.file.name : '';
    },
    getFile() {
      return self.file;
    },
  }))
  .actions(self => ({
    updateProgress(uploadedBytes) {
      self.uploaded = uploadedBytes;
    },
    updateStatusToUploading() {
      self.status = 'UPLOADING';
    },
    updateStatusToComplete() {
      self.status = 'COMPLETE';
    },
    updateStatusToFailed(error) {
      self.status = 'FAILED';
      self.error = error;
    },
    setFile(file) {
      self.file = file;
    },
    setCancel(cancel) {
      self.cancel = cancel;
    },
    doCancel() {
      if (self.cancel) {
        self.cancel();
        self.cancel = undefined;
      }
    },
  }));

const FileUploadGroup = types
  .model('FileUploadGroup', {
    resourceId: types.identifier,
    fileUploads: types.map(FileUpload),
    state: types.union(types.literal('PENDING'), types.literal('UPLOADING'), types.literal('COMPLETE')),
  })
  .views(self => ({
    get fileUploadObjects() {
      return Array.from(self.fileUploads.values());
    },
    getFileUpload(fileUploadId) {
      return self.fileUploads.get(fileUploadId);
    },
  }))
  .actions(self => ({
    async start(fileUploadHandler) {
      if (self.state !== 'PENDING') {
        throw new Error(`Cannot transition state from ${self.state} -> UPLOADING`);
      }
      self.setStateToUploading();
      const fileUploads = Array.from(self.fileUploads.values()).filter(fileUpload => fileUpload.status === 'PENDING');
      await Promise.all(
        fileUploads.map(async fileUpload => {
          fileUpload.updateStatusToUploading();
          try {
            await fileUploadHandler(fileUpload);
          } catch (error) {
            fileUpload.updateStatusToFailed(error.message);
          }
        }),
      );
      self.setStateToComplete();
    },
    cancel() {
      self.fileUploads.forEach(fileUpload => {
        fileUpload.doCancel();
      });
    },
    remove(id) {
      self.fileUploads.delete(id);
    },
    add({ file }) {
      const model = FileUpload.create({
        id: uuidv4(),
        status: 'PENDING',
      });
      model.setFile(file);
      self.fileUploads.put(model);
    },
    setStateToComplete() {
      self.state = 'COMPLETE';
    },
    setStateToUploading() {
      self.state = 'UPLOADING';
    },
  }));

export default FileUploadGroup;
