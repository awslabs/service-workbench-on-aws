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

const _ = require('lodash');

function parseAttributeValue(attributeValue) {
  // value is expected to be an object that follows DynamoDB attribute value conventions
  // see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  if (_.isUndefined(attributeValue)) return undefined;
  if (!_.isObject(attributeValue)) {
    // We don't want to throw this error
    // eslint-disable-next-line no-console
    console.error(new Error(`Expected an object while converting values but received this '${attributeValue}'`));
    if (_.isString(attributeValue)) return attributeValue;
    return JSON.stringify(attributeValue);
  }

  const key = Object.keys(attributeValue)[0];
  const value = attributeValue[key];
  const result = {};

  switch (key) {
    case 'B':
      // B
      // An attribute of type Binary. For example:
      // "B": "dGhpcyB0ZXh0IGlzIGJhc2U2NC1lbmNvZGVk"
      // Type: Base64-encoded binary data object
      return value;

    case 'BOOL':
      // BOOL
      // An attribute of type Boolean. For example:
      // "BOOL": true
      // Type: Boolean
      return value;

    case 'BS':
      // BS
      // An attribute of type Binary Set. For example:
      // "BS": ["U3Vubnk=", "UmFpbnk=", "U25vd3k="]
      // Type: Array of Base64-encoded binary data objects
      return value;

    case 'L':
      // L
      // An attribute of type List. For example:
      // "L": [ {"S": "Cookies"} , {"S": "Coffee"}, {"N", "3.14159"}]
      // Type: Array of AttributeValue objects
      return _.map(value, item => parseAttributeValue(item));

    case 'M':
      // M
      // An attribute of type Map. For example:
      // "M": {"Name": {"S": "Joe"}, "Age": {"N": "35"}}
      // Type: String to AttributeValue object map
      // Key Length Constraints: Maximum length of 65535.
      _.forEach(value, (mValue, mKey) => {
        result[mKey] = parseAttributeValue(mValue);
      });
      return result;

    case 'N':
      // N
      // An attribute of type Number. For example:
      // "N": "123.45"
      // Numbers are sent across the network to DynamoDB as strings, to maximize compatibility across languages and libraries. However, DynamoDB treats them as number type attributes for mathematical operations.
      // Type: String
      return _.toNumber(value);

    case 'NS':
      // NS
      // An attribute of type Number Set. For example:
      // "NS": ["42.2", "-19", "7.5", "3.14"]
      // Numbers are sent across the network to DynamoDB as strings, to maximize compatibility across languages and libraries. However, DynamoDB treats them as number type attributes for mathematical operations.
      // Type: Array of strings
      return _.map(value, _.toNumber);

    case 'NULL':
      // NULL
      // An attribute of type Null. For example:
      // "NULL": true
      // Type: Boolean
      return null;

    case 'S':
      // S
      // An attribute of type String. For example:
      // "S": "Hello"
      // Type: String
      return value;

    case 'SS':
      // SS
      // An attribute of type String Set. For example:
      // "SS": ["Giraffe", "Hippo" ,"Zebra"]
      // Type: Array of strings
      return value;

    default:
      if (_.isObject(value)) return JSON.stringify(value);
      return value;
  }
}

// Given a string, returns an AttributeValue that represents this string
function toStringAttributeValue(str) {
  return { S: str };
}

module.exports = {
  parseAttributeValue,
  toStringAttributeValue,
};
