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

const barOptions = {
  // see https://www.chartjs.org/docs/latest/configuration/legend.html
  // see https://github.com/jerairrest/react-chartjs-2/blob/master/example/src/components/bar.js
  // see https://stackoverflow.com/questions/36676263/chart-js-v2-hiding-grid-lines
  // see https://github.com/jerairrest/react-chartjs-2
  legend: {
    display: false,
  },
  maintainAspectRatio: false,
  scales: {
    // see https://www.chartjs.org/docs/latest/charts/bar.html
    xAxes: [
      {
        // barPercentage: 1,
        // categoryPercentage: 1,
        gridLines: {
          display: false,
        },
      },
    ],
    yAxes: [
      {
        gridLines: {
          display: false,
        },
      },
    ],
  },
};

function blueDatasets(label, data) {
  return [
    {
      label: label || 'Patients Ages 1 to 5',
      backgroundColor: 'rgba(33, 133, 208,0.2)',
      borderColor: 'rgba(33, 133, 208,1)',
      borderWidth: 1,
      // hoverBackgroundColor: 'rgba(255,99,132,0.4)',
      // hoverBorderColor: 'rgba(255,99,132,1)',
      data: data || [1, 8, 5, 6, 3],
    },
  ];
}
export { barOptions, blueDatasets };
