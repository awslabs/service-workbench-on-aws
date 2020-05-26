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
