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

const CollectionResource = require('../base/collection-resource');
const WorkspaceServiceCatalog = require('./workspace-service-catalog');

class WorkspaceServiceCatalogs extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'workspaceServiceCatalogs',
      childType: 'workspaceServiceCatalog',
    });

    this.api = '/api/workspaces/service-catalog';
  }

  // Because Workspace is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling workspaceType(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.workspaceServiceCatalogs.workspaceServiceCatalog(<id>)
  workspaceServiceCatalog(id) {
    return new WorkspaceServiceCatalog({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use get() method on this resource operations helper.
  defaults(workspaceServiceCatalog = {}) {
    const name = workspaceServiceCatalog.name || this.setup.gen.string({ prefix: 'workspace-service-catalog' });
    return {
      name,
      description: this.setup.gen.description(),
      projectId: this.settings.get('projectId'),
      ...workspaceServiceCatalog,
    };
  }

  // ************************ Helpers methods ************************
}

module.exports = WorkspaceServiceCatalogs;
