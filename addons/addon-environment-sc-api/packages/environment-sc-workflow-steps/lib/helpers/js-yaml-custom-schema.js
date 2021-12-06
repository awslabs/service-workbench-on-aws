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

/*
 * Schema created to parse the custom tags in CFT which will not be supported by js-yaml
 * Took the reference from js-yaml example https://github.com/nodeca/js-yaml/blob/a0d0caa5aa0f5354fefa9c637cfb7c4c17ef7d02/examples/handle_unknown_types.js
 */

const YAML = require('js-yaml');

class CustomTag {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
}

const tags = ['scalar', 'sequence', 'mapping'].map(kind => {
  // first argument here is a prefix, so this type will handle anything starting with !
  return new YAML.Type('!', {
    kind,
    multi: true,
    representName(object) {
      return object.type;
    },
    represent(object) {
      return object.data;
    },
    instanceOf: CustomTag,
    construct(data, type) {
      return new CustomTag(type, data);
    },
  });
});

const jsYamlCustomSchema = YAML.DEFAULT_SCHEMA.extend(tags);

module.exports = jsYamlCustomSchema;
