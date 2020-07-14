const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
      minLength: 2,
      pattern: '^[a-zA-Z0-9_\\-]*',
    },
    rev: {
      type: 'number',
    },
    // Name for this workspace-type
    name: {
      type: 'string',
      // product.name and provisioningArtifact.name can be upto 8191 chars each in AWS Service Catalog
      // See https://docs.aws.amazon.com/servicecatalog/latest/dg/API_CreateProduct.html#servicecatalog-CreateProduct-request-Name
      // To accommodate default value ${product.name}-${provisioningArtifact.name} we need 16383
      maxLength: 16383,
      minLength: 2,
      pattern: '^[a-zA-Z0-9_\\-]*',
    },
    // Description for this workspace-type
    // Defaults to provisioningArtifact.description
    desc: {
      type: 'string',
      maxLength: 8191,
    },
    status: {
      type: 'string',
      // not-approved -- An AWS Service Catalog Product that is imported in the "app store" but not approved for researchers' use yet
      // approved -- An AWS Service Catalog Product that is imported in the "app store" as an approved "environment type" for usage
      enum: ['not-approved', 'approved'],
    },
  },
  required: ['id', 'rev'],
};

module.exports = schema;
