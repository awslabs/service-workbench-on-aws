import _ from 'lodash';
import { createForm } from '../../helpers/form';

const getFields = ({ projectIdOptions, cidr }) => {
  const fields = {
    name: {
      label: 'Name',
      placeholder: 'Type a name for this research workspace',
      extra: {
        explain:
          'Name can contain only alphanumeric characters (case sensitive) and hyphens. It must start with an alphabetic character and cannot be longer than 128 characters',
      },
      rules: 'required|string|between:3,128|regex:/^[A-Za-z][A-Za-z0-9-]+$/',
    },
    description: {
      label: 'Description',
      placeholder: 'The description of this research workspace',
      rules: 'required|string|between:3,2048',
    },
    projectId: {
      label: 'Project ID',
      placeholder: 'The project ID associated with this study',
      rules: ['required', 'string', 'min:1', 'max:100'],
      extra: {
        options: projectIdOptions,
      },
    },
    envTypeConfigId: {
      label: 'Configuration',
      placeholder: 'The configuration for the research workspace',
      rules: 'required',
    },
  };

  if (!_.isUndefined(cidr)) {
    fields.cidr = {
      label: 'Restricted CIDR',
      extra: {
        explain: `This research workspace will only be reachable from this CIDR. You can get your organization's CIDR range from your IT department. The provided default is the CIDR that restricts to your IP address.`,
      },
      placeholder: 'The CIDR range to restrict research workspace access to',
      rules: 'required|cidr',
      value: cidr,
    };
  }

  return fields;
};

function getCreateInternalEnvForm(...args) {
  return createForm(getFields(...args));
}

// eslint-disable-next-line import/prefer-default-export
export { getCreateInternalEnvForm };
