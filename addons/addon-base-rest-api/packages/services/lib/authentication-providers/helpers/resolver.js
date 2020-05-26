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

function resolve(locator) {
  // The authentication provider locators would be on of the following formats
  //
  // locator:service:<serviceName>/<methodName> -- for locator pointing to a method of a specific service
  // (the service here refers to a service instance loaded by services container)
  //
  // locator:external-url:<url> -- for locators pointing to a URL of a specific API
  //
  // Make sure the given locator is in one of the expected format
  if (!_.startsWith(locator, 'locator:service:') && !_.startsWith(locator, 'locator:external-url:')) {
    throw new Error(`Malformed locator: ${locator}`);
  }

  const locatorParts = _.split(locator, ':');
  if (locatorParts.length < 3) {
    throw new Error(
      `Malformed locator: ${locator}. Supported locator formats are either 
        - "locator:service:<serviceName>/<methodName>" or 
        - "locator:external-url:<url>".`,
    );
  }

  const typeIndicator = locatorParts[1];
  const path = locatorParts[2]; // will be <serviceName>/<methodName> or <url>

  const typeParsers = {
    'service': () => {
      const [serviceName, methodName] = _.split(path, '/');
      return {
        type: typeIndicator,
        serviceName,
        methodName,
      };
    },
    'external-url': () => {
      return {
        type: typeIndicator,
        url: path,
      };
    },
  };
  const typeParserFn = typeParsers[typeIndicator];
  if (!typeParserFn) {
    throw new Error(
      `Malformed locator: ${locator}. Currently only supporting locators that resolve to a 'service' or and 'external-url'.`,
    );
  }
  return typeParserFn();
}

module.exports = { resolve };
