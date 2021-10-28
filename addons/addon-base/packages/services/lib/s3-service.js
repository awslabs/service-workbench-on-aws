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

const _ = require('lodash');
const path = require('path');
const Service = require('@aws-ee/base-services-container/lib/service');

const moveS3ObjectSchema = require('./schema/move-s3-object');

class S3Service extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'jsonSchemaValidationService']);
  }

  async init() {
    await super.init();
    this.api = await this.getS3();
  }

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }

  async getS3() {
    const aws = await this.getAWS();
    return new aws.sdk.S3({ signatureVersion: 'v4' });
  }

  // files = [ {bucket, key}, {bucket, key} ]
  async sign({ files = [], expireSeconds = 120 } = {}) {
    const s3Client = await this.getS3();
    const signIt = (bucket, key) => {
      return new Promise((resolve, reject) => {
        const params = {
          Bucket: bucket,
          Key: key,
          Expires: expireSeconds,
        };
        s3Client.getSignedUrl('getObject', params, (err, url) => {
          if (err) return reject(err);
          return resolve(url);
        });
      });
    };

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const file of files) {
      const signedUrl = await signIt(file.bucket, file.key);
      file.signedUrl = signedUrl;
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    return files;
  }

  async listObjects({ bucket, prefix }) {
    const s3Client = await this.getS3();
    const params = {
      Bucket: bucket,
      MaxKeys: 980,
      Prefix: prefix,
    };

    const result = [];
    let data;
    do {
      data = await s3Client.listObjectsV2(params).promise(); // eslint-disable-line no-await-in-loop
      params.ContinuationToken = data.NextContinuationToken;
      const prefixSlash = _.endsWith(prefix, '/') ? prefix : `${prefix}/`;

      _.forEach(data.Contents, item => {
        // eslint-disable-line no-loop-func
        if (item.Key === prefixSlash) return;

        result.push({
          key: item.Key,
          bucket,
          fullPath: item.Key.substring(prefixSlash.length),
          isFolder: _.endsWith(item.Key, '/'),
          filename: path.basename(item.Key),
          updatedAt: item.LastModified,
          etag: item.ETag,
          size: item.Size,
          storageClass: item.StorageClass,
        });
      });
    } while (params.ContinuationToken);

    return result;
  }

  /**
   * Parses given s3 location URI in the form "s3://some-bucket/some/path" form and returns an object containing s3BucketName and s3Key.
   * @param s3Location The s3 location uri in s3://some-bucket/some/path format
   * @returns {{s3BucketName: string, s3Key: string}} A promise that resolves to an object with shape {s3BucketName, s3Key}
   */
  parseS3Details(s3Location) {
    const s3Prefix = 's3://';
    if (!_.startsWith(s3Location, s3Prefix)) {
      throw new Error('Incorrect s3Location. Expecting s3Location to be in s3://bucketname/s3key format');
    }
    const s3Path = s3Location.substring(s3Prefix.length, s3Location.length);
    const idxOfFirstSlash = s3Path.indexOf('/');
    const s3BucketName = s3Path.substring(0, idxOfFirstSlash < 0 ? s3Path.length : idxOfFirstSlash);
    const s3Key = s3Path.substring(idxOfFirstSlash + 1, idxOfFirstSlash < 0 ? idxOfFirstSlash : s3Path.length);

    return { s3BucketName, s3Key };
  }

  /**
   * Checks if the given s3Location in the form "s3://some-bucket/some-path" exists
   * @param s3Location The s3 location uri in s3://some-bucket/some/path format
   * @returns {Promise<boolean>} A promise that resolves to a flag indicating whether the specified s3 location exists or not
   */
  async doesS3LocationExist(s3Location) {
    const s3Client = await this.getS3();
    const { s3BucketName, s3Key } = this.parseS3Details(_.trim(s3Location));
    try {
      if (s3Key && s3Key !== '/') {
        // If s3Key is specified and if it is not just trailing forward slash then make sure the
        // prefix specified by the s3Key exists
        // For example, if the s3Location is s3://some-bucket-name/some-object-key then make sure the
        // object or prefix with key "some-object-key" exists in the bucket "some-bucket-name"
        const listingResult = await s3Client
          .listObjectsV2({
            Bucket: s3BucketName,
            Prefix: s3Key,
          })
          .promise();
        return !_.isNil(listingResult) && listingResult.KeyCount > 0;
      }

      // If s3Key is not specified OR if it is just trailing forward slash then make sure the
      // specified bucket exists
      // For example, if the s3Location is "s3://some-bucket-name" or ""s3://some-bucket-name/" then make sure the
      // bucket named "some-bucket-name" exists
      const bucket = await s3Client.headBucket({ Bucket: s3BucketName }).promise();
      return !_.isNil(bucket);
    } catch (err) {
      if (err.code === 'NotFound' || err.code === 'NoSuchBucket' || err.code === 'NoSuchKey') {
        // If the bucket does not exist or the S3 location path does not exist then return false
        return false;
      }
      // in case of any other error, let it bubble up
      throw err;
    }
  }

  // Moves the object by first copying it to the new destination then deleting it from the source
  async moveObject(rawData) {
    const s3Client = await this.getS3();
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(rawData, moveS3ObjectSchema);
    const { from, to } = rawData;

    // we do a copy then we a delete
    const copyParams = {
      Bucket: to.bucket,
      CopySource: `/${from.bucket}/${from.key}`,
      Key: `${to.key}`,
    };

    await s3Client.copyObject(copyParams).promise();
    await s3Client.deleteObject({ Bucket: from.bucket, Key: `${from.key}` }).promise();
  }

  async streamToS3(bucket, toKey, inputStream) {
    const s3Client = await this.getS3();
    return s3Client
      .upload({
        Bucket: bucket,
        Key: toKey,
        Body: inputStream,
      })
      .promise();
  }

  async createPath(bucketName, folderName) {
    const s3Client = await this.getS3();
    const params = {
      Bucket: bucketName,
      Key: folderName,
    };
    return s3Client.putObject(params).promise();
  }

  async clearPath(bucketName, dir) {
    const s3Client = await this.getS3();
    const listedObjects = await this.listAllObjects({ Bucket: bucketName, Prefix: dir });

    if (listedObjects.length === 0) return;

    const deleteParams = {
      Bucket: bucketName,
      Delete: { Objects: [] },
    };

    listedObjects.forEach(({ Key }) => {
      deleteParams.Delete.Objects.push({ Key });
    });
    try {
      await s3Client.deleteObjects(deleteParams).promise();
      if (listedObjects.IsTruncated) await this.clearPath(bucketName, dir);
    } catch (error) {
      throw this.boom.badRequest(`S3Service error with deleting objects in arn:aws:s3:::${bucketName}/${dir}`, true);
    }
  }

  async putObjectTag(bucket, key, tag) {
    const s3Client = await this.getS3();
    const params = {
      Bucket: bucket,
      Key: key,
      Tagging: {
        TagSet: [tag],
      },
    };
    try {
      await s3Client.putObjectTagging(params).promise();
    } catch (error) {
      throw this.boom.badRequest(`S3Service error with putting tag on object arn:aws:s3:::${bucket}/${key}`, true);
    }
  }

  async putObject(params) {
    const s3Client = await this.getS3();
    try {
      await s3Client.putObject(params).promise();
    } catch (error) {
      throw this.boom.badRequest(
        `S3Service error with putting object to bucket: ${params.Bucket} with key: ${params.Key}`,
        true,
      );
    }
  }

  async listAllObjects({ Bucket, Prefix }) {
    const s3Client = await this.getS3();
    // repeatedly calling AWS list objects because it only returns 1000 objects
    let list = [];
    let shouldContinue = true;
    let nextContinuationToken = null;
    do {
      const res = await s3Client // eslint-disable-line no-await-in-loop
        .listObjectsV2({
          Bucket,
          Prefix,
          ContinuationToken: nextContinuationToken || undefined,
        })
        .promise();
      list = [...list, ...res.Contents];

      if (!res.IsTruncated) {
        shouldContinue = false;
        nextContinuationToken = null;
      } else {
        nextContinuationToken = res.NextContinuationToken;
      }
    } while (shouldContinue);
    return list;
  }

  async getLatestObjectVersion({ Bucket, Prefix }) {
    const s3Client = await this.getS3();
    const params = {
      Bucket,
      Prefix,
    };
    const versionList = await s3Client.listObjectVersions(params).promise();
    const latestObjs = _.filter(versionList.Versions, ['IsLatest', true]);
    return latestObjs[0];
  }
}

module.exports = S3Service;
