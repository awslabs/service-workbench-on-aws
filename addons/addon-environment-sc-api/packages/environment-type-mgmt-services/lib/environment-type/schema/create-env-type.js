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
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
      minLength: 2,
      pattern: '^[a-zA-Z0-9_\\-]*$',
    },
    // Name for this workspace-type
    // Defaults to ${product.name}-${provisioningArtifact.name}
    name: {
      type: 'string',
      // product.name and provisioningArtifact.name can be upto 8191 chars each in AWS Service Catalog
      // See https://docs.aws.amazon.com/servicecatalog/latest/dg/API_CreateProduct.html#servicecatalog-CreateProduct-request-Name
      // To accommodate default value ${product.name}-${provisioningArtifact.name} we need 16383
      maxLength: 16383,
      minLength: 2,
      pattern: '^[a-zA-Z0-9_\\-]*$',
    },
    // Description for this workspace-type
    // Defaults to provisioningArtifact.description
    desc: {
      type: 'string',
      maxLength: 8191,
      pattern: '^([^<>{}]*)$',
    },
    status: {
      type: 'string',
      // not-approved -- An AWS Service Catalog Product that is imported in the "app store" but not approved for researchers' use yet
      // approved -- An AWS Service Catalog Product that is imported in the "app store" as an approved "environment type" for usage
      enum: ['not-approved', 'approved'],
    },
    // AWS Service Catalog (SC) product info
    // Currently only contains "productId"
    product: {
      type: 'object',
      additionalProperties: false,
      properties: {
        productId: {
          type: 'string',
          maxLength: 100,
          // This pattern needs to match the pattern for "Id" at https://docs.aws.amazon.com/servicecatalog/latest/dg/API_ProductViewSummary.html
          pattern: '^[a-zA-Z0-9_\\-]*$',
        },
      },
      required: ['productId'],
    },
    // AWS Service Catalog (SC) product provisioningArtifact (aka version) info
    // Maps directly to SC ProvisioningArtifact object
    // Currently only contains id
    provisioningArtifact: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          maxLength: 100,
          // This pattern needs to match the pattern for "Id" at https://docs.aws.amazon.com/servicecatalog/latest/dg/API_ProvisioningArtifact.html
          pattern: '^[a-zA-Z0-9_\\-]*$',
        },
      },
      required: ['id'],
    },
  },
  required: ['id', 'name', 'product', 'provisioningArtifact'],
};

module.exports = schema;
