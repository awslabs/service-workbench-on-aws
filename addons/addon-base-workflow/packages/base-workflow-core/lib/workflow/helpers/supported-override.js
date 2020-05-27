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

const workflowPropsSupportedOverrideKeys = ['title', 'desc', 'instanceTtl', 'runSpecSize', 'runSpecTarget', 'steps'];
const stepPropsSupportedOverrideKeys = ['title', 'desc', 'skippable'];

// Some keys need to be transformed before they are used to lookup a property value
const workflowPropsSupportedOverrideKeysTransformer = key => {
  if (key === 'runSpecSize') return 'runSpec.size';
  if (key === 'runSpecTarget') return 'runSpec.target';
  return key;
};

// Some keys need to be transformed before they are used to lookup a property value
const stepPropsSupportedOverrideKeysTransformer = key => key;

module.exports = {
  workflowPropsSupportedOverrideKeys,
  workflowPropsSupportedOverrideKeysTransformer,
  stepPropsSupportedOverrideKeys,
  stepPropsSupportedOverrideKeysTransformer,
};
