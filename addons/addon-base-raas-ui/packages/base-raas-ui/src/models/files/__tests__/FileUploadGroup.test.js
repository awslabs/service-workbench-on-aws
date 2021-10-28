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
import FileUploadGroup from '../FileUploadGroup';

describe('FileUploadGroup', () => {
  const currentTimeFromEpoch = Date.now();
  const fileName = 'sample.json';
  const size = 0;
  const file = {
    lastModified: currentTimeFromEpoch,
    lastModifiedDate: new Date(currentTimeFromEpoch),
    name: fileName,
    size,
    type: 'application/json',
  };

  const resourceId = 'abcd';

  function getFileUploadObject(fullFilePath) {
    const fileWithTopLevelFolder = JSON.parse(JSON.stringify(file));
    fileWithTopLevelFolder.webkitRelativePath = fullFilePath;

    const fileUploadGroup = FileUploadGroup.create({ resourceId, state: 'PENDING' });

    fileUploadGroup.add({ file: fileWithTopLevelFolder });

    return fileUploadGroup.fileUploadObjects[0];
  }

  it('should handle top level folder correctly', () => {
    const fileUploadObj = getFileUploadObject(`sampleFolder/${fileName}`);

    // OPERATE & CHECK
    expect(fileUploadObj.size).toEqual(size);
    expect(fileUploadObj.name).toEqual(fileName);
    expect(fileUploadObj.folder).toEqual('sampleFolder');
    expect(fileUploadObj.fullFilePath).toEqual(`sampleFolder/${fileName}`);
  });

  it('should handle sub level folder correctly', () => {
    // BUILD
    const fileUploadObj = getFileUploadObject(`sampleFolder/subfolder/${fileName}`);

    // OPERATE & CHECK
    expect(fileUploadObj.size).toEqual(size);
    expect(fileUploadObj.name).toEqual(fileName);
    expect(fileUploadObj.folder).toEqual('sampleFolder/subfolder');
    expect(fileUploadObj.fullFilePath).toEqual(`sampleFolder/subfolder/${fileName}`);
  });

  it('should handle uploading a file correctly', () => {
    // BUILD
    const fileUploadObj = getFileUploadObject('');

    // OPERATE & CHECK
    expect(fileUploadObj.size).toEqual(size);
    expect(fileUploadObj.name).toEqual(fileName);
    expect(fileUploadObj.folder).toEqual('');
    expect(fileUploadObj.fullFilePath).toEqual(fileName);
  });
});
