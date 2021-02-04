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

// Resources created via integration tests should have this description, wherever possible.
// This would make it easier in the future for audit/cleanup
const RESOURCE_DESCRIPTION = 'Resource automatically created by SWB integration test';

function validResponse(response, statusCode = 200, statusText = 'OK') {
  return (
    response.status === statusCode &&
    response.statusText === statusText &&
    !_.isUndefined(response.data) &&
    !_.isEmpty(response.data)
  );
}

module.exports = {
  validResponse,
  RESOURCE_DESCRIPTION,
};
