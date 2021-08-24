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
// require('../EnvTypeConfig');
import EnvTypeConfig from '../EnvTypeConfig';

describe('EnvTypeConfig', () => {
  it('should get the instance type', async () => {
    // BUILD
    const config = {
      id: 'envtypeconfigid',
      name: 'Name',
      desc: 'some desc',
      estimatedCostInfo: 'money',
      params: [{ key: 'InstanceType', value: 't3.large' }],
    };
    const envTypeConfig = EnvTypeConfig.create(config); // Initialize the whole object

    // OPERATE
    const instanceType = envTypeConfig.instanceType;

    // CHECK
    expect(instanceType).not.toBe('Not available');
    expect(instanceType).toBe('t3.large');
  });

  it('should get master instance type from config params for EMR', async () => {
    // BUILD
    const config = {
      id: 'envtypeconfigid',
      name: 'Name',
      desc: 'some desc',
      estimatedCostInfo: 'money',
      params: [{ key: 'MasterInstanceType', value: 't3.large' }],
    };
    const envTypeConfig = EnvTypeConfig.create(config); // Initialize the whole object

    // OPERATE
    const instanceType = envTypeConfig.instanceType;

    // CHECK
    expect(instanceType).not.toBe('Not available');
    expect(instanceType).toBe('t3.large');
  });

  it('should display something graceful when no InstanceType param in config params', async () => {
    // BUILD
    const config = {
      id: 'envtypeconfigid',
      name: 'Name',
      desc: 'some desc',
      estimatedCostInfo: 'money',
      params: [{ key: 'name', value: 'name' }],
    };
    const envTypeConfig = EnvTypeConfig.create(config); // Initialize the whole object

    // OPERATE
    const instanceType = envTypeConfig.instanceType;

    // CHECK
    expect(instanceType).toBe('Not available');
  });
});
