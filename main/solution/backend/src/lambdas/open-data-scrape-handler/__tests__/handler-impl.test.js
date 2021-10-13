jest.mock('@aws-ee/base-raas-services/lib/study/study-service');
const StudyService = require('@aws-ee/base-raas-services/lib/study/study-service');

jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Log = require('@aws-ee/base-services/lib/logger/logger-service');

const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const _ = require('lodash');
const { fetchOpenData, saveOpenData } = require('../handler-impl');

const consoleLogger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
};

describe('fetchAndSaveOpenData', () => {
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

describe('fetchOpenData', () => {
  const validStudyOpenData = {
    description: 'Example study 1',
    id: 'study-2',
    name: 'Study 1',
    resources: [
      {
        arn: 'arn:aws:s3:::study1',
        description: 'Description for Study 1',
        region: 'us-east-1',
        type: 'S3 Bucket',
      },
    ],
    sha: 'abc2',
    tags: ['aws-pds', 'genetic', 'genomic', 'life sciences'],
  };

  const validStudy = {
    name: 'Study 1',
    description: 'Example study 1',
    tags: ['aws-pds', 'genetic', 'genomic', 'life sciences'],
    resources: [
      {
        description: 'Description for Study 1',
        arn: 'arn:aws:s3:::study1',
        region: 'us-east-1',
        type: 'S3 Bucket',
      },
    ],
    id: 'study-2',
    sha: 'abc2',
  };

  const invalidStudy = {
    name: 'Study 2',
    description: 'Example study 2',
    tags: ['aws-pds', 'genetic', 'genomic', 'life sciences'],
    resources: [
      {
        description: 'Description for Study 2',
        arn: 'invalidArn',
        region: 'us-east-1',
        type: 'S3 Bucket',
      },
    ],
    id: 'study-2',
    sha: 'abc2',
  };

  it('has invalid study (Invalid ARN)', async () => {
    const fileUrls = ['firstFileUrl'];
    const requiredTags = ['genetic'];
    const fetchFile = jest.fn();
    fetchFile.mockReturnValueOnce(invalidStudy);

    const result = await fetchOpenData({ fileUrls, requiredTags, log: consoleLogger, fetchFile });
    expect(result).toEqual([]);
  });

  it('has one valid study', async () => {
    const fileUrls = ['firstFileUrl'];
    const requiredTags = ['genetic'];
    const fetchFile = jest.fn();
    fetchFile.mockReturnValueOnce(validStudy);

    const result = await fetchOpenData({ fileUrls, requiredTags, log: consoleLogger, fetchFile });
    expect(result).toEqual([validStudyOpenData]);
  });

  it('has one valid study and one invalid study (Invalid ARN)', async () => {
    const fileUrls = ['firstFileUrl'];
    const requiredTags = ['genetic'];
    const fetchFile = jest.fn();
    fetchFile.mockReturnValueOnce(validStudy).mockReturnValueOnce(invalidStudy);

    const result = await fetchOpenData({ fileUrls, requiredTags, log: consoleLogger, fetchFile });
    expect(result).toEqual([validStudyOpenData]);
  });
});
