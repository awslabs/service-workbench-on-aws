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

/**
 * @typedef {Object} UploadHandle
 * @property {Promise<void>} done a Promise that resolves if the upload completes, or rejects if there is an upload error.
 * @property {() => void} cancel cancels the upload by calling XMLHttpRequest.abort().
 * @property {(callback: (uploadedBytes: number) => void) => void} onProgress used to register event listeners for upload progress events
 */

/**
 * Uploads an HTML file object or a blob using XMLHttpRequest.
 *
 * @params {File|Blob} file
 * @params {sring} url
 * @params {Object<string, any>} fields
 * @returns {UploadHandle}
 */
const upload = (file, url, fields = {}) => {
  const req = new XMLHttpRequest();
  const uploadProgressListeners = [];
  const uploadProgressCallback = uploadedBytes => {
    uploadProgressListeners.forEach(fn => {
      fn(uploadedBytes);
    });
  };

  const done = new Promise((resolve, reject) => {
    req.upload.addEventListener('progress', event => {
      uploadProgressCallback(event.loaded || 0);
    });
    req.upload.addEventListener('error', () => {
      reject(new Error('Network Error'));
    });
    req.onreadystatechange = () => {
      if (req.readyState === 4) {
        // Request is DONE
        if (req.status === 0) {
          // Request status is UNSENT
          reject(new Error('Cancelled'));
        } else if (req.status >= 400 && req.status <= 599) {
          // Request received 4xx or 5xx error
          reject(new Error(`Error: ${req.statusText}`));
        } else {
          resolve();
        }
      }
    };
  });

  const formData = new FormData();
  Object.entries(fields).forEach(([name, value]) => formData.append(name, value));
  formData.append('file', file, file.name);

  req.open('POST', url);
  req.send(formData);

  return {
    done,
    cancel() {
      req.abort();
    },
    onProgress(cb) {
      uploadProgressListeners.push(cb);
    },
  };
};

export default upload;
