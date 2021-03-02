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

class ServiceCatalog {
  constructor({ aws, sdk }) {
    this.aws = aws;
    this.sdk = sdk;
  }

  async getProductName(productId) {
    const response = await this.sdk.describeProduct({ Id: productId }).promise();

    return response.ProductViewSummary.Name;
  }
}

// The aws javascript sdk client name
ServiceCatalog.clientName = 'ServiceCatalog';

module.exports = ServiceCatalog;
