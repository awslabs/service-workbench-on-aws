import { types } from 'mobx-state-tree';

import { parseError } from '../helpers/utils';

const Err = types.model('Err', {
  message: '',
  code: '',
  requestId: '',
});

const toErr = error => {
  const parsed = parseError(error);
  return Err.create({
    message: parsed.message || '',
    code: parsed.code || '',
    requestId: parsed.toErr || '',
  });
};

export { Err, toErr };
