const { fetchOpenData } = require('../handler-impl');

const consoleLogger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
};

describe('fetchOpenData', () => {
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
