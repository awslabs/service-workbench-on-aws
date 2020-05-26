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

const xml = require('xml');

/**
 * Generates an XML document containing AWS tags.
 *
 * @example
 *
 * ```javascript
 * buildTaggingXml(
 *   {
 *     UploadedBy: "me,theuser",
 *     Comment: "<!ENTITY xxe SYSTEM \"file:///etc/passwd\" >]><foo>&xxe;</foo>",
 *   },
 *   true, // pretty print
 * );
 * ```
 *
 * @param {Object<string, any>=} tags
 * @param {boolean=} pretty
 * @returns {string} an xml tagging configuration document
 */
const buildTaggingXml = (tags = {}, pretty = false) =>
  xml(
    {
      Tagging: [
        {
          TagSet: Object.entries(tags).map(([Key, Value]) => ({ Tag: [{ Key }, { Value }] })),
        },
      ],
    },
    { indent: pretty ? '  ' : undefined },
  );

module.exports = {
  buildTaggingXml,
};
