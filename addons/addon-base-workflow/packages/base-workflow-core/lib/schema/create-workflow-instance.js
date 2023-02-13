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
const schema = {
  definitions: {
    runSpec: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['stepFunctions', 'workerLambda', 'inPlace'] },
        size: { type: 'string', enum: ['small', 'medium', 'large'] },
      },
    },
  },
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'http://basedl/root.json',
  type: 'object',
  required: ['workflowId'],
  additionalProperties: false,
  properties: {
    workflowId: { type: 'string' },
    workflowVer: { type: 'integer', minimum: 1 },
    runSpec: { $ref: '#/definitions/runSpec' },
    status: { type: 'string', enum: ['not_started', 'in_progress', 'paused', 'error', 'done'] },
    assignmentId: { type: 'string' },
    smWorkflow: { type: 'string' },
  },
};
module.exports = schema;
