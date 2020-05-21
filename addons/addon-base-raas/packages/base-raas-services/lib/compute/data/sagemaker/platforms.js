// A temporarily place to keep the information about the compute platforms
const _ = require('lodash');

const platforms = [
  {
    id: 'sagemaker-1',
    type: 'sagemaker',
    title: 'SageMaker',
    displayOrder: 1,
    desc: `An Amazon SageMaker Jupyter Notebook that comes with:
  * TensorFlow
  * Apache MXNet
  * Scikit-learn
`,
  },
];

// Which user can view which type
const getPlatforms = () => _.slice(platforms); // All users can see all platforms

module.exports = {
  getPlatforms,
};
