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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { registerServices } = require('@aws-ee/base-services/lib/utils/services-registration-util');
const pluginRegistry = require('./plugins/plugin-registry');

const handler = async event => {
  const container = new ServicesContainer([]);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);
  await container.initServices();

  await handlerWithContainer(container, event);
};

const handlerWithContainer = async (container, event) => {
  // put tag action under condition of if this is a create object action
  const isPutEvent = event.Records[0].eventName.startsWith('ObjectCreated:Put');
  const bucketName = event.Records[0].s3.bucket.name;
  const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  const objectPath = objectKey.split('/');
  const egressStoreId = objectPath[0];
  if (isPutEvent) {
    const tag = {
      Key: 'egressStore',
      Value: egressStoreId,
    };
    if (objectPath[1] && objectPath[1].length !== 0) {
      const s3Service = await container.find('s3Service');
      await s3Service.putObjectTag(bucketName, objectKey, tag);
    }
  }
  const dataEgressService = await container.find('dataEgressService');
  const egressStoreInfo = await dataEgressService.getEgressStoreInfo(egressStoreId);
  if (!egressStoreInfo.isAbleToSubmitEgressRequest && S3FileWasAdded(event.Records)) {
    await dataEgressService.enableEgressStoreSubmission(egressStoreInfo);
  }
};

const S3FileWasAdded = records => {
  let fileWasAdded = false;
  records.forEach(record => {
    // Sometimes an S3 Put event is created for a file path/folder being created, but no actual file was placed in the bucket.
    // In that scenario the file object size is 0
    if (record.s3.object.size > 0) {
      fileWasAdded = true;
    }
  });
  return fileWasAdded;
};

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = handler;
module.exports.handlerWithContainer = handlerWithContainer;
