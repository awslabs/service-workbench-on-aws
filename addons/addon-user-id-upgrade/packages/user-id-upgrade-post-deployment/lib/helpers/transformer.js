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

class Transformer {
  // transforms are a list of functions that apply transformation
  constructor({ transforms = [], uidLookup, tableReport }) {
    this.uidLookup = uidLookup;
    this.tableReport = tableReport;
    this.transforms = transforms;
  }

  // An item is the raw Item object returned by DynamoDB which is
  // a map of AttributeValues.
  // For more information about AttributeValues, see
  // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  //
  // This method transforms the item from the old format to the new format using the
  // transforms functions.
  transform(item) {
    const transforms = this.transforms;
    const findings = [];
    const logger = {
      log: entry => findings.push(entry),
    };

    _.forEach(transforms, transformFn => {
      transformFn(this.uidLookup, item, logger);
    });

    if (!_.isEmpty(findings)) {
      this.tableReport.addFindings(item, findings);
    }
  }
}

module.exports = Transformer;
