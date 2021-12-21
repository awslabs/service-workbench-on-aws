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

const { chopLeft, chopRight } = require('./utils');

/**
 * Parses the S3 arn string and returns an object representing the different parts (awsPartition, bucket, prefix).
 * This function handles an S3 arn with any partition and also can parse s3 arn resources that end with '/*'.
 * If it can't parse the arn, it returns undefined.
 *
 * @param arn A possible S3 arn string
 */
function parseS3Arn(arn = '') {
  // arn:aws:s3:::123456789012-study/studies/Organization/org-study-a1/*
  let trimmed = _.trim(arn);
  if (_.isEmpty(arn)) return;

  if (!_.startsWith(trimmed, 'arn:')) return;

  // Remove the 'arn:' part
  trimmed = trimmed.substring('arn:'.length);

  // Get the partition part
  const partition = _.nth(_.split(trimmed, ':'), 0);

  // Check if it is still an s3 arn
  if (!_.startsWith(trimmed, `${partition}:s3:::`)) return;

  // Remove the partition part
  trimmed = trimmed.substring(`${partition}:s3:::`.length);

  // Get the bucket part
  const bucket = _.nth(_.split(trimmed, '/'), 0);

  // Check if the bucket is not an empty string
  if (_.isEmpty(bucket)) return;

  // Remove the bucket part
  trimmed = trimmed.substring(bucket.length);

  let prefix = '/';
  if (!_.isEmpty(trimmed)) {
    prefix = chopLeft(trimmed, '/');
    prefix = chopRight(prefix, '*');
    prefix = _.endsWith(prefix, '/') ? prefix : `${prefix}/`;
  }

  // eslint-disable-next-line consistent-return
  return {
    awsPartition: partition,
    bucket,
    prefix,
  };
}

/**
 * Takes a possible s3 arn string and returns an s3 arn that always ends with forward slash and does not have
 * a trailing asterisk. If the s3 arn string is not an s3 arn, it will be returned as is.
 *
 * @param s3Arn s3 arn string
 */
function normalizeS3Arn(s3Arn) {
  const parsed = parseS3Arn(s3Arn);
  if (_.isEmpty(parsed)) return s3Arn;

  const { awsPartition, bucket, prefix } = parsed;

  return prefix === '/' ? `arn:${awsPartition}:s3:::${bucket}/` : `arn:${awsPartition}:s3:::${bucket}/${prefix}`;
}

// Takes any s3arn and return only the bucket s3arn (no folders)
function normalizeBucketArn(s3Arn) {
  const parsed = parseS3Arn(s3Arn);
  if (_.isEmpty(parsed)) return s3Arn;

  const { awsPartition, bucket } = parsed;

  return `arn:${awsPartition}:s3:::${bucket}`;
}

function toS3Arn({ bucket, awsPartition, folder }) {
  return folder === '/' ? `arn:${awsPartition}:s3:::${bucket}/` : `arn:${awsPartition}:s3:::${bucket}/${folder}`;
}

module.exports = { parseS3Arn, normalizeS3Arn, toS3Arn, normalizeBucketArn };
