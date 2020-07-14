import _ from 'lodash';
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

function getAddEnvTypeBasicInfoForm(envType) {
  const addEnvTypeBasicInfoFormFields = {
    name: {
      label: 'Name',
      placeholder: 'Name for this workspace type',
      extra: {
        explain:
          'Easily identifiable name for this workspace type. ' +
          'It must be an alpha numeric string starting with an alphabet and ' +
          'may contain underscore ( _ ) and/or dash ( - ).',
      },
      value: _.get(envType, 'name') || '',
      rules: ['required', 'min:2', 'max:16383', 'regex:/^[a-zA-Z0-9_\\-]*/'],
    },
    desc: {
      label: 'Description',
      placeholder: 'Description for this workspace type',
      extra: { explain: 'Description for this workspace type. Markdown syntax is supported' },
      value: _.get(envType, 'desc') || '',
      rules: 'max:8191|string',
    },
  };

  return createForm(addEnvTypeBasicInfoFormFields);
}

// eslint-disable-next-line import/prefer-default-export
export { getAddEnvTypeBasicInfoForm };
