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
