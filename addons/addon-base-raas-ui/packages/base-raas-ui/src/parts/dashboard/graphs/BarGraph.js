 /*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *  
 *  http://aws.amazon.com/apache2.0
 *  
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

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
