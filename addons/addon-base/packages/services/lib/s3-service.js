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
    const aws = await this.service('aws');
    this.api = new aws.sdk.S3({ signatureVersion: 'v4' });
  }

  // files = [ {bucket, key}, {bucket, key} ]
  async sign({ files = [], expireSeconds = 120 } = {}) {
    const signIt = (bucket, key) => {
      return new Promise((resolve, reject) => {
        const params = {
          Bucket: bucket,
          Key: key,
          Expires: expireSeconds,
        };
        this.api.getSignedUrl('getObject', params, (err, url) => {
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
    const params = {
      Bucket: bucket,
      MaxKeys: 980,
      Prefix: prefix,
    };

    const result = [];
    let data;
    do {
      data = await this.api.listObjectsV2(params).promise(); // eslint-disable-line no-await-in-loop
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
    const { s3BucketName, s3Key } = this.parseS3Details(_.trim(s3Location));
    try {
      if (s3Key && s3Key !== '/') {
        // If s3Key is specified and if it is not just trailing forward slash then make sure the
        // prefix specified by the s3Key exists
        // For example, if the s3Location is s3://some-bucket-name/some-object-key then make sure the
        // object or prefix with key "some-object-key" exists in the bucket "some-bucket-name"
        const listingResult = await this.api
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
      const bucket = await this.api.headBucket({ Bucket: s3BucketName }).promise();
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

    await this.api.copyObject(copyParams).promise();
    await this.api.deleteObject({ Bucket: from.bucket, Key: `${from.key}` }).promise();
  }

  async streamToS3(bucket, toKey, inputStream) {
    return this.api
      .upload({
        Bucket: bucket,
        Key: toKey,
        Body: inputStream,
      })
      .promise();
  }
}

module.exports = S3Service;
