import React from 'react';
import { observer } from 'mobx-react';
import { Header } from 'semantic-ui-react';
import c from 'classnames';

// expected props
// - field (via props), this is the mobx form field object
// - className (via props)
const Component = observer(({ field, className = 'mt0 mb1' }) => {
  const { id, label } = field;

  return (
    <Header className={c('field', className)} as="h3">
      <label className="color-grey" htmlFor={id}>
        {label}
      </label>
    </Header>
  );
});

export default Component;
