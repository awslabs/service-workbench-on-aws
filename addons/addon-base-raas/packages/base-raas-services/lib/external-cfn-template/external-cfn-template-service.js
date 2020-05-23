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

const Service = require('@aws-ee/base-services-container/lib/service');

class ExternalCfnTemplateService extends Service {
  constructor() {
    super();
    this.dependency(['s3Service']);
  }

  async init() {
    await super.init();
  }

  async getSignS3Url(key) {
    const [s3Service] = await this.service(['s3Service']);
    const bucket = this.settings.get('externalCfnTemplatesBucketName');
    const request = { files: [{ key, bucket }] };
    const urls = await s3Service.sign(request);
    return urls[0].signedUrl;
  }

  async mustGetSignS3Url(key) {
    const result = await this.getSignS3Url(key);
    if (!result) throw this.boom.notFound(`template with key "${key}" does not exist`, true);
    return result;
  }
}

module.exports = ExternalCfnTemplateService;
