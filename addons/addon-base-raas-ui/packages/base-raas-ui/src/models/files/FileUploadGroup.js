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
    get fullFilePath() {
      if (self.file) {
        return self.file.webkitRelativePath ? self.file.webkitRelativePath : self.file.name;
      }
      return '';
    },
    get folder() {
      if (self.file && self.file.webkitRelativePath) {
        const regExpForReplacingFileName = new RegExp(`/${self.file.name}$`);
        return self.file.webkitRelativePath.replace(regExpForReplacingFileName, '');
      }
      return '';
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
