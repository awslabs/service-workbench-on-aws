import _ from 'lodash';
import { createForm } from '../../helpers/form';

function getNameValueForm({ name, value, nameLabel, namePlaceholder, valueLabel, valuePlaceholder }) {
  const fields = {
    name: {
      label: _.isNil(nameLabel) ? 'Name' : nameLabel,
      placeholder: _.isNil(namePlaceholder) ? 'Name' : namePlaceholder,
      rules: 'required',
      value: name,
    },
    value: {
      label: _.isNil(valueLabel) ? 'Value' : valueLabel,
      placeholder: _.isNil(valuePlaceholder) ? 'Value' : valuePlaceholder,
      rules: 'required',
      value,
    },
  };
  return createForm(fields);
}

// eslint-disable-next-line import/prefer-default-export
export { getNameValueForm };
