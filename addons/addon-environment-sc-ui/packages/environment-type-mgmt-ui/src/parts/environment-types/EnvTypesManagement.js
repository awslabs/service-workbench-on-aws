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
import { Container, Divider } from 'semantic-ui-react';

import EnvTypeCandidatesList from './EnvTypeCandidatesList';
import EnvTypesList from './EnvTypesList';

function EnvTypesManagement() {
  return (
    <Container className="mt3">
      <EnvTypeCandidatesList />
      <Divider />
      <EnvTypesList />
    </Container>
  );
}

export default observer(EnvTypesManagement);
