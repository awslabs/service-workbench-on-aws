const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
      minLength: 2,
      pattern: '^[A-Za-z0-9-_]+$',
    },
    name: {
      type: 'string',
      maxLength: 128,
      minLength: 2,
      pattern: '^[A-Za-z0-9-_ ]+$',
    },
    desc: {
      type: 'string',
      maxLength: 8191,
    },
    // A string explaining estimated cost
    estimatedCostInfo: {
      type: 'string',
      maxLength: 1024,
    },
    allowRoleIds: {
      type: 'array',
      items: [
        {
          type: 'string',
          maxLength: 100,
          pattern: '^[A-Za-z0-9-_ ]+$',
        },
      ],
    },
    denyRoleIds: {
      type: 'array',
      items: [
        {
          type: 'string',
          maxLength: 100,
          pattern: '^[A-Za-z0-9-_ ]+$',
        },
      ],
    },

    // An array of param mapping objects containing mapping of CFN parameters to
    // values or to dynamic variable expressions
    params: {
      type: 'array',
      items: [
        {
          type: 'object',
          properties: {
            key: {
              type: 'string', // The name of the CFN parameter
            },
            value: {
              type: 'string', // The value for the CFN param or variable expression such as ${vpcId} that will be resolved at the time of launching envs
            },
          },
        },
      ],
    },

    // Optional array of tags to be applied to the product stack when it
    // is launched
    tags: {
      type: 'array',
      items: [
        {
          type: 'object',
          properties: {
            key: {
              type: 'string', // Tag name
            },
            value: {
              type: 'string', // Tag value
            },
          },
        },
      ],
    },
  },
  required: ['id', 'name'],
};

module.exports = schema;
