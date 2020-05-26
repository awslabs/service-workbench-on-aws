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

const { flattenSection, validateSection } = require('../input-manifest');

describe('flattenSection', () => {
  it('flattens an empty input manifest section into an empty array', () => {
    expect(flattenSection({})).toEqual([]);
  });

  it('flattens an input manifest section into an array of entries', () => {
    const got = flattenSection(
      {
        children: [
          {
            name: 'A',
            children: [{ name: 'C' }, { name: 'D', condition: '<%= false %>' }],
          },
          {
            name: 'B',
            condition: 'false',
            children: [{ name: 'shouldNotBeEmitted' }],
          },
        ],
      },
      {},
    );
    expect(got).toEqual([
      {
        name: 'A',
        children: [{ name: 'C' }, { name: 'D', condition: '<%= false %>' }],
      },
      { name: 'C' },
    ]);
  });

  it('evaluates the top level condition, if it is present', () => {
    const got = flattenSection(
      {
        condition: '<%= shouldEmitCount > 0 %>',
        children: [
          {
            name: 'foo',
          },
        ],
      },
      {
        shouldEmitCount: 0,
      },
    );

    expect(got).toEqual([]);
  });

  it('evaluates a conditions as true, if condition key is missing', () => {
    const got = flattenSection(
      {
        children: [
          {
            name: 'foo',
          },
        ],
      },
      {
        shouldEmitCount: 0,
      },
    );

    expect(got).toEqual([{ name: 'foo' }]);
  });

  it('uses the passed in config to evaluate the top level condition', () => {
    const got = flattenSection(
      {
        condition: '<%= someValue > 3 %>',
        children: [{ name: 'foo' }],
      },
      { someValue: 2 },
    );
    expect(got).toEqual([]);
  });

  it('uses the passed in config to evaluate nested conditions', () => {
    const got = flattenSection(
      {
        children: [
          { name: 'foo', condition: '<%= someValue == 2 %>' },
          { name: 'bar', condition: '<%= someValue < 0 %>' },
        ],
      },
      { someValue: 2 },
    );
    expect(got).toEqual([
      {
        name: 'foo',
        condition: '<%= someValue == 2 %>',
      },
    ]);
  });
});

describe('validateSection', () => {
  it('validates an input manifest section against a config object', () => {
    const got = validateSection(
      {
        children: [
          {
            name: 'A',
            rules: 'required|integer',
          },
        ],
      },
      {
        A: 'some string',
      },
    );
    expect(got).toEqual([
      {
        type: 'invalid',
        message: 'The A must be an integer.',
      },
    ]);
  });

  it('validates that required keys are present and defined', () => {
    const got = validateSection(
      {
        children: [
          {
            name: 'A',
            rules: 'required|integer',
          },
          {
            name: 'B',
            rules: 'required|integer',
          },
        ],
      },
      {
        A: undefined,
      },
    );
    expect(got).toEqual([
      {
        type: 'invalid',
        message: 'The A field is required.',
      },
      {
        type: 'invalid',
        message: 'The B field is required.',
      },
    ]);
  });

  it('validates that extra keys are not present if extraKeysAreInvalid is true', () => {
    const got = validateSection(
      {
        children: [
          {
            name: 'A',
            rules: 'required|integer',
          },
        ],
      },
      {
        A: 1,
        B: 'extra!',
      },
      true,
    );
    expect(got).toEqual([
      {
        type: 'extra',
        message: 'The B is present in config but missing in manifest',
      },
    ]);
  });
});
