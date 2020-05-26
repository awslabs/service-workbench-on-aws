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

import { flattenObject, unFlattenObject } from '../utils';

describe('helpers/utils', () => {
  describe('flattenObject --- is working fine if,', () => {
    it('it leaves already flat object of key/value pairs as is', () => {
      const input = { someKey: 'someValue' };
      const expectedOutput = { someKey: 'someValue' };
      const output = flattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it flattens a simple object graph into a flat object with key/value pairs', () => {
      const input = { someKey: { someNestedKey: 'someValue' } };
      const expectedOutput = { 'someKey.someNestedKey': 'someValue' };
      const output = flattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it flattens an object graph with arrays correctly', () => {
      const input = { someKey: ['someValue1', 'someValue2'] };
      const expectedOutput = { 'someKey[0]': 'someValue1', 'someKey[1]': 'someValue2' };
      const output = flattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it flattens an object graph with nested arrays correctly', () => {
      const input = { someKey: ['someValue1', ['someValue2', 'someValue3'], 'someValue4'] };
      const expectedOutput = {
        'someKey[0]': 'someValue1',
        'someKey[1][0]': 'someValue2',
        'someKey[1][1]': 'someValue3',
        'someKey[2]': 'someValue4',
      };
      const output = flattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it flattens an object graph with arrays containing nested object graphs correctly', () => {
      const input = { someKey: [{ someNestedKey: 'someValue', nestedArr: [1, 2, { nestedArrKey: 'value' }] }] };
      const expectedOutput = {
        'someKey[0].someNestedKey': 'someValue',
        'someKey[0].nestedArr[0]': 1,
        'someKey[0].nestedArr[1]': 2,
        'someKey[0].nestedArr[2].nestedArrKey': 'value',
      };
      const output = flattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
  });
  describe('unFlattenObject --- is working fine if it a correct inverse of the flattenObject, it is correct inverse if', () => {
    it('it leaves object with keys without any delimiters as is', () => {
      const expectedOutput = { someKey: 'someValue' };
      const input = flattenObject(expectedOutput);
      const output = unFlattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it unFlattens a simple object graph into from a flat object with key/value pairs', () => {
      const expectedOutput = { someKey: { someNestedKey: 'someValue' } };
      const input = flattenObject(expectedOutput);
      const output = unFlattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it unFlattens to an object graph with arrays correctly', () => {
      const expectedOutput = { someKey: ['someValue1', 'someValue2', 'someValue3'] };
      const input = flattenObject(expectedOutput);
      const output = unFlattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it unFlattens to an object graph with nested arrays correctly', () => {
      const expectedOutput = { someKey: ['someValue1', ['someValue2', 'someValue3'], 'someValue4'] };
      const input = flattenObject(expectedOutput);
      // input = { "someKey_0": "someValue1", "someKey_1_0": "someValue2", "someKey_1_1": "someValue3", "someKey_2": "someValue4" };
      const output = unFlattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
    it('it unFlattens to an object graph with arrays containing nested object graphs correctly', () => {
      const expectedOutput = {
        someKey: [{ someNestedKey: 'someValue', nestedArr: [1, 2, { nestedArrKey: 'value' }] }],
      };
      const input = flattenObject(expectedOutput);
      // input = { 'someKey[0].someNestedKey': 'someValue', 'someKey[0].nestedArr[0]': 1, 'someKey[0].nestedArr[1]': 2, 'someKey[0].nestedArr[2].nestedArrKey': 'value' };
      const output = unFlattenObject(input);

      expect(output).toEqual(expectedOutput);
    });
  });
});
