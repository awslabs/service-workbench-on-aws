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

class Table {
  constructor({ dynamoDb, name }) {
    this.name = name;
    this.dynamoDb = dynamoDb;
    this.aws = dynamoDb.aws;
    this.settings = dynamoDb.aws.settings;
    this.sdk = dynamoDb.sdk;

    const helpers = dynamoDb.helpers;
    const prefix = dynamoDb.aws.settings.get('dbPrefix');
    const fullName = `${prefix}-${_.upperFirst(name)}`;

    this.fullName = fullName;
    this.query = () => helpers.query().table(fullName);
    this.scanner = () => helpers.scanner().table(fullName);
    this.getter = () => helpers.getter().table(fullName);
    this.updater = () => helpers.updater().table(fullName);
    this.deleter = () => helpers.deleter().table(fullName);
  }
}

module.exports = Table;
