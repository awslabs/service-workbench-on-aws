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

const _ = require('lodash');

const CollectionResource = require('../base/collection-resource');

class StudyFiles extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'studyFiles',
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [StudyFiles]');
    this.api = `${parent.api}/files`;
  }

  // ************************ Helpers methods ************************
}

module.exports = StudyFiles;
