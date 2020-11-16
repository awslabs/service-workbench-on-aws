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

const TableError = require('./table-error');

class GetItem {
  constructor(tableName, dynamoDbApi) {
    this.tableName = tableName;
    this.api = dynamoDbApi;
    this.params = {
      TableName: tableName,
      ReturnConsumedCapacity: 'TOTAL',
    };
  }

  // The key is expected to be the raw Key param that you pass to the dynamodb.getItem() function
  // see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property
  async get(key) {
    try {
      this.params.Key = key;
      const result = await this.api.getItem(this.params).promise();
      return result;
    } catch (error) {
      throw new TableError(this.tableName)
        .operation('get')
        .key(key)
        .cause(error);
    }
  }
}

module.exports = GetItem;
