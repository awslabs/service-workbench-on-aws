/* eslint-disable react/no-danger */
import React from 'react';
import { observer } from 'mobx-react';
import c from 'classnames';
import { Message } from 'semantic-ui-react';

// expected props
// - field (via props), this is the mobx form field object
const Component = observer(({ field }) => {
  const { extra = {} } = field;
  const explain = (extra || {}).explain;
  const warn = (extra || {}).warn;
  const hasExplain = !!explain;
  const hasWarn = !!warn;

  return (
    <>
      {hasExplain && <div className={c('field', 'mb2')} dangerouslySetInnerHTML={{ __html: explain }} />}
      {hasWarn && (
        <Message className="field" color="brown">
          <b className="mr1">Warning</b>
          {warn}
        </Message>
      )}
    </>
  );
});

export default Component;
