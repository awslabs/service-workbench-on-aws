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
    id: 'ec2-rstudio-1',
    type: 'ec2-rstudio',
    title: 'RStudio Server',
    displayOrder: 3,
    desc: `Data analysis and integrated development experience for professional R users`,
  },
  {
    id: 'ec2-linux-1',
    type: 'ec2-linux',
    title: 'EC2 - Linux',
    displayOrder: 4,
    desc: `Secure, resizable compute in the cloud`,
  },
  {
    id: 'ec2-windows-1',
    type: 'ec2-windows',
    title: 'EC2 - Windows',
    displayOrder: 5,
    desc: `Secure, resizable compute in the cloud`,
  },
];

// Which user can view which type
const getPlatforms = user => (_.get(user, 'userRole') !== 'external-researcher' ? _.slice(platforms) : []); // external researchers can't view ec2 platforms for now

module.exports = {
  getPlatforms,
};
