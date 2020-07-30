import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

function getKeyPairCreateForm() {
  const fields = {
    name: {
      label: 'Name',
      placeholder: 'Name for this key',
      extra: {
        explain:
          'Easily identifiable name for this key. The name is used for display purposes.' +
          'It must be an alpha numeric string between 2 and 100 characters long may contain space, underscore (_) and/or dash (-).',
      },
      value: '',
      rules: ['required', 'min:2', 'max:100', 'regex:/^[A-Za-z0-9-_ ]+$/'],
    },
    desc: {
      label: 'Description',
      placeholder: 'Describe the purpose of this key, up to 1024 characters long.',
      value: '',
      rules: 'max:1024|string',
    },
  };

  return createForm(fields);
}

// eslint-disable-next-line import/prefer-default-export
export { getKeyPairCreateForm };
