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

function getRegisterStudyForm() {
  const fields = [
    'account.id',
    'account.name',
    'account.description',
    'account.contactInfo',
    'account.mainRegion',
    'bucket.name',
    'bucket.region',
    'bucket.sse',
    'bucket.kmsArn',
    'studies',
    'studies[].id',
    'studies[].name',
    'studies[].folder',
    'studies[].kmsArn',
    'studies[].category',
    'studies[].accessType',
    'studies[].projectId',
    'studies[].description',
    'studies[].adminUsers',
  ];

  const labels = {
    'account.id': 'AWS Account ID',
    'account.name': 'Account Name',
    'account.contactInfo': 'Contact Information',
    'account.mainRegion': 'Region',
    'bucket.name': 'Bucket Name',
    'bucket.region': 'Bucket Region',
    'bucket.sse': 'Bucket Default Encryption',
    'bucket.kmsArn': 'KMS Arn',
    'studies': 'Studies',
    'studies[].id': 'Study Id',
    'studies[].name': 'Study Name',
    'studies[].folder': 'Study Folder',
    'studies[].kmsArn': 'Study KMS Arn',
    'studies[].category': 'Type',
    'studies[].accessType': 'Access',
    'studies[].projectId': 'Project',
    'studies[].description': 'Description',
    'studies[].adminUsers': 'Admin',
  };

  const placeholders = {
    'account.id': 'Type the AWS account id',
    'account.name': 'Give a name to this account. This is for UI display purposes only',
    'account.mainRegion': 'Pick a region',
    'account.contactInfo':
      '(Optional) Type the contact information for the admins of this account. This information is purely for your convenience and it does not have any impact on the registration process.',
    'bucket.name': 'The name of the bucket',
    'bucket.region': 'Pick the bucket region',
    'bucket.sse': 'Bucket encryption',
    'bucket.kmsArn': 'KMS Arn (alias arn is not supported)',
    'studies[].id': 'A unique id for the study',
    'studies[].name': 'A name for the study',
    'studies[].folder': 'The study path in the bucket',
    'studies[].kmsArn': 'Only provide the kms arn if it is different for this study',
    'studies[].projectId': 'The project to associate with the study',
  };

  const extra = {
    'account.id': {
      explain: 'The AWS account id that owns the bucket that contains the studies',
    },
    'account.mainRegion': {
      explain: 'Pick a region that you intend to deploy the CloudFormation stack in',
    },
    'studies[].category': {
      yesLabel: 'My Study',
      noLabel: 'Organization Study',
      yesValue: 'My Studies',
      noValue: 'Organization',
    },

    'studies[].accessType': {
      yesLabel: 'Read Only',
      noLabel: 'Read & Write',
      yesValue: 'readonly',
      noValue: 'readwrite',
    },
  };

  const rules = {
    'account.id': 'required|min:12|max:12|regex:/^[0-9]+$/',
    'account.name': 'required|max:300',
    'account.mainRegion': 'required',
    'bucket.name': 'required',
    'bucket.region': 'required',
    'bucket.sse': 'required',
    'bucket.kmsArn': 'required',
    'studies': 'required',
    'studies[].id': 'required|string|between:1,100|regex:/^[A-Za-z0-9-_]+$/',
    'studies[].name': 'string|max:2048',
    'studies[].folder': 'required|min:1|max:1000',
    'studies[].kmsArn': 'string|max:90',
    'studies[].category': 'required',
    'studies[].adminUsers': 'required',
  };

  const values = {
    bucket: {
      sse: 'kms',
    },
  };

  return createFormSeparatedFormat({ fields, labels, placeholders, extra, rules, values });
}

// eslint-disable-next-line import/prefer-default-export
export { getRegisterStudyForm };
