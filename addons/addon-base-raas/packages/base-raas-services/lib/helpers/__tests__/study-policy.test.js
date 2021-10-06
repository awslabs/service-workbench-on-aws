const { StudyPolicy } = require('../iam/study-policy');

describe('study-policy', () => {
  it('generate the correct policy', () => {
    const studyPolicy = new StudyPolicy();

    const item = {
      bucket: 'test-S3BucketName',
      folder: ['test-folder'],
      permission: {
        read: true,
        write: true,
      },
      kmsArn: 'testKmsArn',
    };

    studyPolicy.addStudy(item);
    expect(studyPolicy.toPolicyDoc()).toEqual({
      Statement: [
        {
          Action: [
            's3:GetObject',
            's3:GetObjectTagging',
            's3:GetObjectTorrent',
            's3:GetObjectVersion',
            's3:GetObjectVersionTagging',
            's3:GetObjectVersionTorrent',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:PutObjectTagging',
            's3:PutObjectVersionTagging',
            's3:DeleteObject',
            's3:DeleteObjectTagging',
            's3:DeleteObjectVersion',
            's3:DeleteObjectVersionTagging',
          ],
          Effect: 'Allow',
          Resource: ['arn:aws:s3:::test-S3BucketName/test-folder*'],
          Sid: 'S3StudyReadWriteAccess',
        },
        {
          Action: ['s3:ListBucket', 's3:ListBucketVersions'],
          Condition: {
            StringLike: {
              's3:prefix': ['test-folder*'],
            },
          },
          Effect: 'Allow',
          Resource: 'arn:aws:s3:::test-S3BucketName',
          Sid: 'studyListS3Access1',
        },
        {
          Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
          Effect: 'Allow',
          Resource: ['testKmsArn'],
          Sid: 'studyKMSAccess',
        },
      ],
      Version: '2012-10-17',
    });
  });
});
