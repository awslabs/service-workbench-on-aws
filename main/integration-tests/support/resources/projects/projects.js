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
const Project = require('./project');

class Projects extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'projects',
      childType: 'project',
      childIdProp: 'id',
    });

    this.api = '/api/projects';
  }

  // Because Projects is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling project(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.projects.project(<id>)
  project(id) {
    return new Project({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(project = {}) {
    const projId = project.id || this.setup.gen.string({ prefix: 'project-test' });
    return {
      description: this.setup.gen.description(),
      id: projId,
      indexId: project.indexId,
      projectAdmins: [],
      ...project,
    };
  }

  // ************************ Helpers methods ************************
  async mustFind(id) {
    const projects = await this.get();
    const project = _.find(projects, proj => proj.id === id);

    if (_.isEmpty(project)) throw new Error(`project "${id}" is not found`);
    return project;
  }
}

module.exports = Projects;
