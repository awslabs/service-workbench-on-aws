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
    // Name for this key-pair
    name: {
      type: 'string',
      maxLength: 100,
      minLength: 2,
      pattern: '^[a-zA-Z0-9_\\-]*',
    },
    // Description for this key-pair
    desc: {
      type: 'string',
      maxLength: 1024,
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive'],
    },
  },
  required: ['id', 'rev'],
};

module.exports = schema;
