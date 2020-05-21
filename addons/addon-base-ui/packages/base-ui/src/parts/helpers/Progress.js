import React from 'react';
import { Progress } from 'semantic-ui-react';

export default ({ message = 'Loading...', className = 'p3' }) => (
  <div className={`${className}`}>
    <Progress percent={100} active color="blue">
      <span className="color-grey">{message}</span>
    </Progress>
  </div>
);
