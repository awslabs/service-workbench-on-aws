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

class DbService extends Service {
  async init() {
    this.client = {};

    // DynamoDB table mock. It matches the functions that
    // a dynamodb table client offers (scan, get, key, etc).

    /**
     * Examples of how to use dbService in unit tests. To mock
     * the response of the typical calls to update, get, scan, etc:
     *
     * dbService.table.scan.mockReturnValueOnce([{ id: 'Test_ID' }]);
     *
     * or mock that an exception is thrown
     *
     * dbService.table.delete.mockImplementationOnce(() => {
     *  throw error
     * });
     *
     * or assert that an update is invoked with the correct key/id
     *
     * expect(dbService.table.key).toHaveBeenCalledWith({ id: '123'; });
     *
     * Notice the use of mockImplementationOnce() and mockReturnValueOnce(),
     * it's very important to mock it `Once` so that subsequent tests do
     * not adopt the mock behavior of the last test that used the dbService.
     */
    this.table = {
      // Following functions use builder pattern to enhance request
      key: jest.fn().mockReturnThis(),
      sortKey: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      projection: jest.fn().mockReturnThis(),
      rev: jest.fn().mockReturnThis(),
      item: jest.fn().mockReturnThis(),
      condition: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      index: jest.fn().mockReturnThis(),
      remove: jest.fn().mockReturnThis(),
      names: jest.fn().mockReturnThis(),
      begins: jest.fn().mockReturnThis(),
      add: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      return: jest.fn().mockReturnThis(),

      // Following functions are actual calls to dynamo
      scan: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),

      client: { createSet: jest.fn() },
    };

    const tableFn = jest.fn().mockReturnValue(this.table);
    this.helper = {
      unmarshal: {},
      scanner: jest.fn().mockReturnValue({ table: tableFn }),
      updater: jest.fn().mockReturnValue({ table: tableFn }),
      getter: jest.fn().mockReturnValue({ table: tableFn }),
      query: jest.fn().mockReturnValue({ table: tableFn }),
      deleter: jest.fn().mockReturnValue({ table: tableFn }),
    };
  }
}

module.exports = DbService;
