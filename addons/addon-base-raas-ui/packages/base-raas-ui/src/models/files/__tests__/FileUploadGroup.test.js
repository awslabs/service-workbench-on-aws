import FileUploadGroup from '../FileUploadGroup';

describe('FileUploadGroup', () => {
  const currentTimeFromEpoch = Date.now();
  const file = {
    lastModified: currentTimeFromEpoch,
    lastModifiedDate: new Date(currentTimeFromEpoch),
    name: 'sample.json',
    size: 0,
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
    const fileUploadObj = getFileUploadObject('sampleFolder/sample.json');

    // OPERATE & CHECK
    expect(fileUploadObj.folder).toEqual('sampleFolder');
    expect(fileUploadObj.fullFilePath).toEqual('sampleFolder/sample.json');
  });

  it('should handle sub level folder correctly', () => {
    // BUILD
    const fileUploadObj = getFileUploadObject('sampleFolder/subfolder/sample.json');

    // OPERATE & CHECK
    expect(fileUploadObj.folder).toEqual('sampleFolder/subfolder');
    expect(fileUploadObj.fullFilePath).toEqual('sampleFolder/subfolder/sample.json');
  });
});
