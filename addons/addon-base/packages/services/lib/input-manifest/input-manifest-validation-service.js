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

const Service = require('@aws-ee/base-services-container/lib/service');
const { validateSection } = require('./input-manifest');

module.exports = class InputManifestValidationService extends Service {
  /**
   * @returns Array of validation errors. If there are no errors, then returns an empty array.
   */
  async getValidationErrors(inputManifest, config) {
    const { sections = [] } = inputManifest;
    const errors = [];
    sections.forEach(section => {
      errors.push(...validateSection(section, config));
    });
    return errors;
  }
};
