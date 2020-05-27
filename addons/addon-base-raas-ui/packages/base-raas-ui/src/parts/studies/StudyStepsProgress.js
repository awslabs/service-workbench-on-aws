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
import { Step, Icon } from 'semantic-ui-react';

// expected props
// currentStep an instance of the CurrentStep model
const Component = observer(({ currentStep = {} }) => {
  let activeIndex;
  const step = currentStep.step;

  switch (step) {
    case 'selectComputePlatform':
      activeIndex = 1;
      break;
    case 'selectComputeConfiguration':
      activeIndex = 2;
      break;
    default:
      activeIndex = 0;
  }

  return (
    <Step.Group widths={3}>
      <Step active={activeIndex === 0} disabled={activeIndex < 0}>
        <Icon name="search" color="blue" />
        <Step.Content>
          <Step.Title>Find &amp; Select Studies</Step.Title>
          <Step.Description>Select the desired studies</Step.Description>
        </Step.Content>
      </Step>
      <Step active={activeIndex === 1} disabled={activeIndex < 1}>
        <Icon name="server" />
        <Step.Content>
          <Step.Title>Select Compute</Step.Title>
          <Step.Description>Select a compute platform</Step.Description>
        </Step.Content>
      </Step>
      <Step active={activeIndex === 2} disabled={activeIndex < 2}>
        <Icon name="hdd outline" />
        <Step.Content>
          <Step.Title>Create Workspace</Step.Title>
          <Step.Description>Create the workspace</Step.Description>
        </Step.Content>
      </Step>
    </Step.Group>
  );
});

export default Component;
