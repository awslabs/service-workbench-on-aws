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

import _ from 'lodash';
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const workflowStepConfigOverrideFields = step => {
  const rows = step.configOverrideSummaryRows || [];
  return _.map(rows, ({ name, title, allowed = false }) => ({
    name,
    label: title,
    value: allowed,
    default: allowed,
  }));
};

function getWorkflowStepConfigOverrideForm(step) {
  const fields = workflowStepConfigOverrideFields(step);
  return createForm(fields);
}

export default getWorkflowStepConfigOverrideForm;
