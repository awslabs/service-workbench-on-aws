import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import c from 'classnames';

// expected props
// - field (via props), this is the mobx form field object
const Component = observer(({ field, className }) => {
  const { error = '' } = field;
  const hasError = !_.isEmpty(error); // IMPORTANT do NOT use field.hasError

  if (!hasError) return null;
  return <div className={c('ui pointing basic label', className)}>{error}</div>;
});

export default Component;
