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
  const bucketName = event.Records[0].s3.bucket.name;
  const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  const objectPath = objectKey.split('/');
  const tag = {
    Key: 'egressStore',
    Value: objectPath[0],
  };
  if (objectPath[1] && objectPath[1].length !== 0) {
    const s3Service = await container.find('s3Service');
    await s3Service.putObjectTag(bucketName, objectKey, tag);
  }
};

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = handler;
module.exports.handlerWithContainer = handlerWithContainer;
