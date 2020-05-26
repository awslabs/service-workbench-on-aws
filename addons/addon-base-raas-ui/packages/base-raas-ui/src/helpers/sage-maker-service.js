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

const SageMaker = require('aws-sdk/clients/sagemaker');

export default class SageMakerService {
  constructor(accessKeyId, secretAccessKey, region = 'us-east-1') {
    if (accessKeyId) {
      this.sm = new SageMaker({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      });
    } else {
      this.sm = new SageMaker({
        sslEnabled: true,
      });
    }
  }

  async getPresignedNotebookInstanceUrl(notebookInstanceName) {
    const params = {
      NotebookInstanceName: notebookInstanceName,
    };
    return this.sm.createPresignedNotebookInstanceUrl(params).promise();
  }
}
