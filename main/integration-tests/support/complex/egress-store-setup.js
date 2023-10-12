/* eslint-disable no-console */
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

async function putTestTxtFileInS3({ aws, bucketName = '', environmentId }) {
  const s3 = await aws.services.s3();

  const result = await s3.putObject(bucketName, `${environmentId}/test1.txt`, 'Hello World!');

  return {
    Key: 'test1.txt',
    ETag: result.ETag,
    StorageClass: 'STANDARD',
    workspaceId: environmentId,
    ChecksumAlgorithm: [], // new attribute introduced in Feb 2022 https://aws.amazon.com/blogs/aws/new-additional-checksum-algorithms-for-amazon-s3/
  };
}

async function deleteTestTxtFileInS3({ aws, bucketName = '', environmentId }) {
  const s3 = await aws.services.s3();

  await s3.deleteObject(`s3://${bucketName}/${environmentId}/test1.txt`);
}

module.exports = { putTestTxtFileInS3, deleteTestTxtFileInS3 };
