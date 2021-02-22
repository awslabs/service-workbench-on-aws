/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
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

const { run } = require('../../utils/utils');

class S3 {
  constructor({ aws, sdk }) {
    this.aws = aws;
    this.sdk = sdk;
  }

  async listObjects(bucket, prefix) {
    const params = {
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 900,
    };

    const result = [];

    do {
      const response = await this.sdk.listObjectsV2(params).promise();
      const keys = _.map(response.Contents, item => item.Key);

      result.push(...keys);

      if (response.IsTruncated) {
        params.ContinuationToken = response.NextContinuationToken;
      } else {
        delete params.ContinuationToken;
      }
    } while (!_.isEmpty(params.ContinuationToken));

    return result;
  }

  /**
   * Deletes everything inside the folder and the folder itself. The folder should be the full path.
   * An example of a folder is 'studies/Organization/anon-user-get-files-org-study-test-1613828306167-xxxx'
   *
   * @param {string} bucket The bucket name
   * @param {string} folder The full folder path
   */
  async deleteFolder(bucket, folder) {
    const keys = await this.listObjects(bucket, folder);
    const params = {
      Bucket: bucket,
    };

    for (const key of keys) {
      params.Key = key;
      await run(async () => this.sdk.deleteObject(params).promise());
    }
  }
}

// The aws javascript sdk client name
S3.clientName = 'S3';

module.exports = S3;
