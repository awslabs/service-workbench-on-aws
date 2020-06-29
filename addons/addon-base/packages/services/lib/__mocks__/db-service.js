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
    const scan = jest.fn(() => [
      {
        id: 'Test_ID',
      },
    ]);
    const table = jest.fn(() => ({
      scan,
    }));
    this.helper = {
      unmarshal: {},
      scanner: jest.fn(() => ({ table })),
      updater: jest.fn(() => ({ table })),
      getter: jest.fn(() => ({ table })),
      query: jest.fn(() => ({ table })),
      deleter: jest.fn(() => ({ table })),
    };
  }
}

module.exports = DbService;
