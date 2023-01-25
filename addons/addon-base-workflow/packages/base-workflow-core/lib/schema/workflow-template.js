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
    markdown: {
      type: 'string',
    },
    description: {
      $ref: '#/definitions/markdown',
    },
    overrideOption: {
      type: 'object',
      properties: {
        allowed: { type: 'array', items: { type: 'string' }, default: [] },
      },
    },
    runSpec: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['stepFunctions', 'workerLambda', 'inPlace'] },
        size: { type: 'string', enum: ['small', 'medium', 'large'] },
      },
    },
    selectedStep: {
      type: 'object',
      properties: {
        stepTemplateId: { type: 'string', pattern: '^(.*)$' },
        stepTemplateVer: { type: 'integer', minimum: 0 },
        propsOverrideOption: { $ref: '#/definitions/overrideOption' },
        configOverrideOption: { $ref: '#/definitions/overrideOption' },
        title: { type: 'string' },
        desc: { $ref: '#/definitions/description' },
        skippable: { type: 'boolean' },
        defaults: { type: 'object' },
        id: { type: 'string' },
      },
      additionalProperties: false,
      required: ['stepTemplateId', 'stepTemplateVer', 'id'],
    },
  },
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'http://basedl/root.json',
  type: 'object',
  required: ['id', 'v', 'title', 'selectedSteps', 'propsOverrideOption'],
  additionalProperties: false,
  properties: {
    id: {
      $id: '#/properties/id',
      type: 'string',
      pattern: '^(.*)$',
    },
    v: {
      $id: '#/properties/v',
      type: 'integer',
      minimum: 0,
    },
    title: {
      $id: '#/properties/title',
      type: 'string',
      default: '',
      pattern: '^(.*)$',
    },
    desc: {
      $ref: '#/definitions/description',
    },
    hidden: { type: 'boolean', default: false },
    builtin: { type: 'boolean', default: false },
    selectedSteps: { type: 'array', items: { $ref: '#/definitions/selectedStep' }, default: [] },
    propsOverrideOption: { $ref: '#/definitions/overrideOption' },
    instanceTtl: { oneOf: [{ type: 'null' }, { type: 'number', default: -1 }] },
    runSpec: { $ref: '#/definitions/runSpec' },
  },
};
module.exports = schema;
