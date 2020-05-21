import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import c from 'classnames';
import TimeAgo from 'react-timeago';

// expected props
// - date (via props)
// - emptyMessage (via props) (a message to display when the date is empty)
// - className (via props)
const Component = observer(({ date, className, emptyMessage = 'Not Provided' }) => {
  if (_.isEmpty(date)) return <span className={c(className)}>{emptyMessage}</span>;
  const formatter = (_value, _unit, _suffix, _epochSeconds, nextFormatter) =>
    (nextFormatter() || '').replace(/ago$/, 'old');
  return (
    <span className={c(className)}>
      <TimeAgo date={date} formatter={formatter} />
    </span>
  );
});

export default Component;
