/* eslint-disable no-console */
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

const Resource = require('../base/resource');
const StudyPermissions = require('./study-permissions');
const StudyFiles = require('./study-files');
const StudyUploadRequests = require('./study-upload-requests');
const { deleteStudy } = require('../../complex/delete-study');

class Study extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'study',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [study]');
  }

  // StudyPermissions is a child resource operations helper
  permissions() {
    return new StudyPermissions({ clientSession: this.clientSession, parent: this });
  }

  // StudyFiles is a child resource operations helper
  files() {
    return new StudyFiles({ clientSession: this.clientSession, parent: this });
  }

  // StudyUploadRequests is a child resource operations helper
  uploadRequest() {
    return new StudyUploadRequests({ clientSession: this.clientSession, parent: this });
  }

  async cleanup() {
    await deleteStudy({ aws: this.setup.aws, id: this.id });
  }

  // ************************ Helpers methods ************************
}

module.exports = Study;
