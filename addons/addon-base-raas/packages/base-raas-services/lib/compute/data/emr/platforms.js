// A temporarily place to keep the information about the compute platforms
const _ = require('lodash');

const platforms = [
  {
    id: 'emr-1',
    type: 'emr',
    title: 'EMR',
    displayOrder: 2,
    desc: `An Amazon EMR research workspace that comes with:
  * Hail 0.2
  * Jupyter Lab
  * Spark 2.4.4
  * Hadoop 2.8.5
`,
  },
];

// Which user can view which type
const getPlatforms = () => _.slice(platforms); // all users can see all emr platforms

module.exports = {
  getPlatforms,
};
