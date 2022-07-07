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

const Service = require('@amzn/base-services-container/lib/service');

const Scanner = require('./db/scanner');
const Updater = require('./db/updater');
const Getter = require('./db/getter');
const Query = require('./db/query');
const Deleter = require('./db/deleter');
const unmarshal = require('./db/unmarshal');

class DbService extends Service {
  constructor() {
    super();
    this.dependency('aws');
  }

  async init() {
    await super.init();
    const aws = await this.service('aws');
    this.dynamoDb = new aws.sdk.DynamoDB({ apiVersion: '2012-08-10' });
    // Setting convertEmptyValues = true below, without this, if any item is asked to be updated with any attrib containing empty string
    // the dynamo update operation fails with
    // "ExpressionAttributeValues contains invalid value: One or more parameter values were invalid: An AttributeValue may not contain an empty string for key :desc" error
    // See https://github.com/aws/aws-sdk-js/issues/833 for details
    this.client = new aws.sdk.DynamoDB.DocumentClient({
      convertEmptyValues: true,
    });

    this.helper = {
      unmarshal,
      scanner: () => new Scanner(this.log, this.client),
      updater: () => new Updater(this.log, this.client),
      getter: () => new Getter(this.log, this.client),
      query: () => new Query(this.log, this.client),
      deleter: () => new Deleter(this.log, this.client),
    };
  }
}

module.exports = DbService;
