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

import React from 'react';
import { observer } from 'mobx-react';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import BaseEnvTypeConfigStep from './BaseEnvTypeConfigStep';

class BasicInfoStep extends BaseEnvTypeConfigStep {
  renderFormFields({ form, processing }) {
    const isUpdating = this.isEditAction();

    const idField = form.$('id');
    const nameField = form.$('name');
    const descField = form.$('desc');
    const estimatedCostInfoField = form.$('estimatedCostInfo');

    return (
      <>
        {!isUpdating && <Input dataTestId="config-id-input" field={idField} disabled={processing} />}
        <Input dataTestId="config-name-input" field={nameField} disabled={processing} />
        <TextArea dataTestId="config-desc-input" field={descField} disabled={processing} />
        <TextArea field={estimatedCostInfoField} disabled={processing} />
      </>
    );
  }
}

export default observer(BasicInfoStep);
