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
