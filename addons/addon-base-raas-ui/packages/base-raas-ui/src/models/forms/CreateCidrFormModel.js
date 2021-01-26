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

import { createFormSeparatedFormat } from '../../helpers/form';

const createCidrFormModel = ({ existingValues }) => {
  const fields = ['cidr', 'cidr[].fromPort', 'cidr[].toPort', 'cidr[].protocol', 'cidr[].cidrBlocks'];

  const labels = {
    'cidr': 'cidr',
    'cidr[].fromPort': 'From Port',
    'cidr[].toPort': 'To Port',
    'cidr[].protocol': 'Protocol',
    'cidr[].cidrBlocks': 'Allowed CIDR Blocks',
  };

  const placeholders = {
    'cidr[].cidrBlocks': 'Enter CIDR ranges here',
  };

  const extra = {};

  const rules = {
    'cidr': 'required',
    'cidr[].fromPort': 'required|integer',
    'cidr[].toPort': 'required|integer',
    'cidr[].protocol': 'required',
    'cidr[].cidrBlocks': 'array',
  };

  const values = {
    cidr: existingValues,
  };

  return createFormSeparatedFormat({ fields, labels, placeholders, extra, rules, values });
};

// eslint-disable-next-line import/prefer-default-export
export { createCidrFormModel };
