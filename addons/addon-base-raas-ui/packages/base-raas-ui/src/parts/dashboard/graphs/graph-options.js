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
      label: label || 'Label',
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
