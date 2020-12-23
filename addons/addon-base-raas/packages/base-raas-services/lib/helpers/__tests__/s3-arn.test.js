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

const { parseS3Arn, normalizeS3Arn, toS3Arn, normalizeBucketArn } = require('../s3-arn');

describe('s3 arn helpers', () => {
  const arn1 = 'arn:aws:s3:::bucket-data/users/example@example.com/my-study-1';
  const arn2 = 'arn:aws:s3:::bucket-data/users/example@example.com/my-study-1/';
  const arn3 = 'arn:aws:s3:::bucket-data/users/example@example.com/my-study-1/*';
  const arn4 = 'arn:aws:s3:::bucket-data/a';
  const arn5 = 'arn:aws:s3:::bucket-data/*';
  const arn6 = 'arn:aws:s3:::bucket-data/';
  const arn7 = 'arn:aws:s3:::bucket-data';
  const arn8 = 'arn:aws-us-gov:s3:::bucket-data';
  const arn9 = 'arn:aws-cn:s3:::bucket-data';
  describe('parseS3Arn', () => {
    it('it returns undefined if it can not parse the arn', () => {
      expect(parseS3Arn('')).toBeUndefined();
      expect(parseS3Arn('arn:aws:sms')).toBeUndefined();
      expect(parseS3Arn('arn:aws:s3')).toBeUndefined();
      expect(parseS3Arn('arn:aws:s3:::')).toBeUndefined();
    });

    it('it returns correct the parts', () => {
      const output = (partition, bucket, prefix) => ({ awsPartition: partition, bucket, prefix });
      expect(parseS3Arn(arn1)).toStrictEqual(output('aws', 'bucket-data', 'users/example@example.com/my-study-1/'));
      expect(parseS3Arn(arn2)).toStrictEqual(output('aws', 'bucket-data', 'users/example@example.com/my-study-1/'));
      expect(parseS3Arn(arn3)).toStrictEqual(output('aws', 'bucket-data', 'users/example@example.com/my-study-1/'));
      expect(parseS3Arn(arn4)).toStrictEqual(output('aws', 'bucket-data', 'a/'));
      expect(parseS3Arn(arn5)).toStrictEqual(output('aws', 'bucket-data', '/'));
      expect(parseS3Arn(arn6)).toStrictEqual(output('aws', 'bucket-data', '/'));
      expect(parseS3Arn(arn7)).toStrictEqual(output('aws', 'bucket-data', '/'));
      expect(parseS3Arn(arn8)).toStrictEqual(output('aws-us-gov', 'bucket-data', '/'));
      expect(parseS3Arn(arn9)).toStrictEqual(output('aws-cn', 'bucket-data', '/'));
    });
  });

  describe('normalizeS3Arn', () => {
    it('Should return correct arn with a forward slash at end', () => {
      expect(normalizeS3Arn(arn1)).toEqual('arn:aws:s3:::bucket-data/users/example@example.com/my-study-1/');
      expect(normalizeS3Arn(arn2)).toEqual('arn:aws:s3:::bucket-data/users/example@example.com/my-study-1/');
      expect(normalizeS3Arn(arn3)).toEqual('arn:aws:s3:::bucket-data/users/example@example.com/my-study-1/');
      expect(normalizeS3Arn(arn4)).toEqual('arn:aws:s3:::bucket-data/a/');
      expect(normalizeS3Arn(arn5)).toEqual('arn:aws:s3:::bucket-data/');
      expect(normalizeS3Arn(arn6)).toEqual('arn:aws:s3:::bucket-data/');
      expect(normalizeS3Arn(arn7)).toEqual('arn:aws:s3:::bucket-data/');
      expect(normalizeS3Arn(arn8)).toEqual('arn:aws-us-gov:s3:::bucket-data/');
      expect(normalizeS3Arn(arn9)).toEqual('arn:aws-cn:s3:::bucket-data/');
    });
  });

  describe('normalizeBucketArn', () => {
    it('Should return correct arn without folder', () => {
      expect(normalizeBucketArn(arn1)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn2)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn3)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn4)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn5)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn6)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn7)).toEqual('arn:aws:s3:::bucket-data');
      expect(normalizeBucketArn(arn8)).toEqual('arn:aws-us-gov:s3:::bucket-data');
      expect(normalizeBucketArn(arn9)).toEqual('arn:aws-cn:s3:::bucket-data');
    });
  });

  describe('toS3Arn', () => {
    it('Should return correct S3 arn', () => {
      expect(toS3Arn({ bucket: 'bucket-data', awsPartition: 'aws', folder: '/' })).toEqual('arn:aws:s3:::bucket-data/');
      expect(
        toS3Arn({ bucket: 'bucket-data', awsPartition: 'aws-cn', folder: 'users/example@example.com/my-study-1/' }),
      ).toEqual('arn:aws-cn:s3:::bucket-data/users/example@example.com/my-study-1/');
    });
  });
});
