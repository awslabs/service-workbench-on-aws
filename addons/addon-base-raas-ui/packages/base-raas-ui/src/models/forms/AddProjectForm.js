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

import { createForm } from '../../helpers/form';

const addProjectFormFields = {
  id: {
    label: 'Project ID',
    placeholder: 'Type id for this project',
    rules: 'required|string|between:1,300',
  },
  indexId: {
    label: 'Index ID',
  },
  description: {
    label: 'Description',
    placeholder: 'Type description for this project',
    rules: 'string|between:1,3000',
  },
};

function getAddProjectFormFields() {
  return addProjectFormFields;
}

function getAddProjectForm() {
  return createForm(addProjectFormFields);
}

export { getAddProjectFormFields, getAddProjectForm };
