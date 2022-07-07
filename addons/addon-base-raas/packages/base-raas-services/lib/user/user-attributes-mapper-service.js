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

const BaseAttribMapperService = require('@amzn/base-api-services/lib/authentication-providers/built-in-providers/cogito-user-pool/user-attributes-mapper-service');

class UserAttributesMapperService extends BaseAttribMapperService {
  mapAttributes(decodedToken) {
    const userAttributes = super.mapAttributes(decodedToken);
    // For Service Workbench solution, the user's email address should be used as his/her username
    // so set username to be email address
    userAttributes.username = userAttributes.email;

    return userAttributes;
  }
}

module.exports = UserAttributesMapperService;
