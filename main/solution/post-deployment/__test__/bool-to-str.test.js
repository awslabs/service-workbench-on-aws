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

const result = require('../bool-to-str');

jest.mock('../config/settings/.settings');
const mergeSettingsMock = require('../config/settings/.settings');

describe('bool-to-str', () => {
  it('should return "true" when enableEgressStore = true', async () => {
    // BUILD
    mergeSettingsMock.merged = jest.fn(async () => {
      return { enableEgressStore: true };
    });

    // OPERATE n CHECK
    expect(await result()).toEqual('true');
  });

  it('should return "false" when enableEgressStore = false', async () => {
    // BUILD
    mergeSettingsMock.merged = jest.fn(async () => {
      return { enableEgressStore: false };
    });

    // OPERATE n CHECK
    expect(await result()).toEqual('false');
  });
});
