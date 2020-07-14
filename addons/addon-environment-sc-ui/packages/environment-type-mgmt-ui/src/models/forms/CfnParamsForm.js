import _ from 'lodash';
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

/**
 * Creates a MobX React Form with field for each cfn param. The fields are pre-populated with existing values.
 * @param cfnParams Array of AWS CloudFormation Input Parameters. See below example for the shape of this object
 *    [{
            "DefaultValue": "ml.t3.xlarge",
            "IsNoEcho": false,
            "ParameterConstraints": {
                "AllowedValues": []
            },
            "ParameterType": "String",
            "Description": "EC2 instance type to launch",
            "ParameterKey": "InstanceType"
        }]
 *
 * @param existingParamValues Array containing key/value pairs for existing values for the params. Has the shape [{key,value}]
 */
function getCfnParamsForm(cfnParams, existingParamValues) {
  const fields = {};
  _.forEach(cfnParams, ({ ParameterKey, Description, DefaultValue }) => {
    const existingValue = _.get(_.find(existingParamValues, { key: ParameterKey }), 'value') || DefaultValue;
    fields[ParameterKey] = {
      label: ParameterKey,
      extra: { explain: Description },
      value: existingValue,
      rules: 'required',
    };
  });
  return createForm(fields);
}

// eslint-disable-next-line import/prefer-default-export
export { getCfnParamsForm };
