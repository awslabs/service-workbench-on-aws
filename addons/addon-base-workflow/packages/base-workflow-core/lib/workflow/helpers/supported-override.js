const workflowPropsSupportedOverrideKeys = ['title', 'desc', 'instanceTtl', 'runSpecSize', 'runSpecTarget', 'steps'];
const stepPropsSupportedOverrideKeys = ['title', 'desc', 'skippable'];

// Some keys need to be transformed before they are used to lookup a property value
const workflowPropsSupportedOverrideKeysTransformer = key => {
  if (key === 'runSpecSize') return 'runSpec.size';
  if (key === 'runSpecTarget') return 'runSpec.target';
  return key;
};

// Some keys need to be transformed before they are used to lookup a property value
const stepPropsSupportedOverrideKeysTransformer = key => key;

module.exports = {
  workflowPropsSupportedOverrideKeys,
  workflowPropsSupportedOverrideKeysTransformer,
  stepPropsSupportedOverrideKeys,
  stepPropsSupportedOverrideKeysTransformer,
};
