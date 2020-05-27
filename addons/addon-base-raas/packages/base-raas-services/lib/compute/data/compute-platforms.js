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

// A temporarily place to keep the information about the compute platforms and their configurations
const sagemaker = require('./sagemaker/platforms');
const emr = require('./emr/platforms');
const ec2 = require('./ec2/platforms');

const getPlatforms = (user = {}) => {
  return [...sagemaker.getPlatforms(user), ...emr.getPlatforms(user), ...ec2.getPlatforms(user)];
};

module.exports = {
  getPlatforms,
};
