jest.mock('@aws-ee/base-raas-services/lib/study/study-service');
const StudyService = require('@aws-ee/base-raas-services/lib/study/study-service');

jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Log = require('@aws-ee/base-services/lib/logger/logger-service');

const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const _ = require('lodash');
const { getOpenDataMetadata, saveOpenData } = require('../handler-impl');

const consoleLogger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
};

describe('saveOpenData', () => {
  const log = new Log();
  const studyService = new StudyService();
  const systemContext = getSystemRequestContext();
  const studyData = {
    description: 'Example study 1',
    id: 'study-2',
    name: 'Study 1',
    resources: [
      {
        arn: 'arn:aws:s3:::study1',
      },
    ],
    sha: 'abc2',
    category: 'Open Data',
  };

  it('should update study with the correct input', async () => {
    studyService.find.mockResolvedValueOnce({ rev: 0 });
    await saveOpenData(log, [studyData], studyService);
    expect(studyService.find).toHaveBeenCalledWith(systemContext, 'study-2');
    expect(studyService.update).toHaveBeenCalledWith(systemContext, { rev: 0, ..._.omit(studyData, 'category') });
  });
  it('should create study with the correct input', async () => {
    await saveOpenData(log, [studyData], studyService);
    expect(studyService.find).toHaveBeenCalledWith(systemContext, 'study-2');
    expect(studyService.create).toHaveBeenCalledWith(systemContext, studyData);
  });
  it('should still resolve if study update fails', async () => {
    studyService.find.mockResolvedValueOnce({ rev: 0 });
    studyService.update.mockImplementationOnce(async () => {
      throw new Error('Study update error');
    });
    await expect(saveOpenData(log, [studyData], studyService)).resolves.toMatchObject([studyData]);
  });
});

describe('getOpenDataMetadata', () => {
  const validStudyOpenData = {
    description: 'Example study 1',
    category: 'Open Data',
    id: 'study-2',
    name: 'Study 1',
    resources: [
      {
        arn: 'arn:aws:s3:::study1',
      },
    ],
    tags: ['aws-pds', 'genetic', 'genomic', 'life sciences'],
  };

  const validStudy = {
    Name: 'Study 1',
    Description: 'Example study 1',
    Tags: ['aws-pds', 'genetic', 'genomic', 'life sciences'],
    Resources: [
      {
        Description: 'Description for Study 1',
        Arn: 'arn:aws:s3:::study1',
        Region: 'us-east-1',
        Type: 'S3 Bucket',
      },
    ],
    Slug: 'study-2',
  };

  const invalidStudy = {
    Name: 'Study 2',
    Description: 'Example study 2',
    Tags: ['aws-pds', 'genetic', 'genomic', 'life sciences'],
    Resources: [
      {
        Description: 'Description for Study 2',
        Arn: 'invalidArn',
        Region: 'us-east-1',
        Type: 'S3 Bucket',
      },
    ],
    Slug: 'study-2',
  };

  it('has invalid study (Invalid ARN)', async () => {
    const openDataTagFilters = ['genetic'];
    const getObject = jest.fn(() => ({
      promise: () => {
        const metadataNdJson = `${JSON.stringify(invalidStudy)}\n`;
        return Promise.resolve({
          Body: metadataNdJson,
        });
      },
    }));
    const S3 = {};
    S3.getObject = getObject;

    const result = await getOpenDataMetadata(S3, openDataTagFilters, consoleLogger);
    expect(result).toEqual([]);
  });

  it('has one valid study', async () => {
    const openDataTagFilters = ['genetic'];
    const getObject = jest.fn(() => ({
      promise: () => {
        const metadataNdJson = `${JSON.stringify(validStudy)}\n`;
        return Promise.resolve({
          Body: metadataNdJson,
        });
      },
    }));
    const S3 = {};
    S3.getObject = getObject;

    const result = await getOpenDataMetadata(S3, openDataTagFilters, consoleLogger);
    expect(result).toEqual([validStudyOpenData]);
  });

  it('has one valid study and one invalid study (Invalid ARN)', async () => {
    const openDataTagFilters = ['genetic'];
    const getObject = jest.fn(() => ({
      promise: () => {
        const metadataNdJson = `${JSON.stringify(validStudy)}\n${JSON.stringify(invalidStudy)}`;
        return Promise.resolve({
          Body: metadataNdJson,
        });
      },
    }));
    const S3 = {};
    S3.getObject = getObject;

    const result = await getOpenDataMetadata(S3, openDataTagFilters, consoleLogger);
    expect(result).toEqual([validStudyOpenData]);
  });
});
