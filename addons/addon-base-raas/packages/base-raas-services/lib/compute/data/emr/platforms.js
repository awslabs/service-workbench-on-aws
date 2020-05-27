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
