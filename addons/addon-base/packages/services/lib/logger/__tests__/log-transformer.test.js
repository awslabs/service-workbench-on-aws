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

const LogTransformer = require('../log-transformer');

describe('LogTransformer', () => {
  it('formats log message and masks sensitive fields', () => {
    const logTransformer = new LogTransformer({}, ['secret']);
    expect(logTransformer.transformForLog({ a: '1', secret: 'should not be seen' })).toEqual(
      `{
  "logLevel": "log",
  "a": "1",
  "secret": "****"
}`,
    );
  });

  it('should fail for invalid fieldsToMask', () => {
    expect(() => new LogTransformer({}, { key: 'val' })).toThrow();
    expect(() => new LogTransformer({}, ['a', 'b', {}, []])).toThrow();
  });
});
