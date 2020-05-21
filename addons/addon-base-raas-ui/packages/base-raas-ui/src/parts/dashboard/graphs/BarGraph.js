import React from 'react';
import { Bar } from 'react-chartjs-2';

import { barOptions } from './graph-options';

const BarGraph = ({ className, data, title, width = 250, height = 120 }) => {
  return (
    <div className={className}>
      <div className="fs-9 center mt1 mb1">{title}</div>
      <div>
        <Bar className={className} data={data} width={width} height={height} options={barOptions} />
      </div>
    </div>
  );
};

export default BarGraph;
