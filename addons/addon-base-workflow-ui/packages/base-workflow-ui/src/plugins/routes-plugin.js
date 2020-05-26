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

import withAuth from '@aws-ee/base-ui/dist/withAuth';

import WorkflowTemplatesList from '../parts/workflow-templates/WorkflowTemplatesList';
import WorkflowTemplateDraftEditor from '../parts/workflow-templates/drafts/edit/WorkflowTemplateDraftEditor';
import WorkflowsList from '../parts/workflows/WorkflowsList';
import WorkflowDraftEditor from '../parts/workflows/drafts/edit/WorkflowDraftEditor';
import WorkflowDetailPage from '../parts/workflows/published/WorkflowDetailPage';
import WorkflowInstanceDetailPage from '../parts/workflows/published/WorkflowInstanceDetailPage';

/**
 * Adds routes to the given routesMap.
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and React Component as value.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of base routes vs React Component
 */
// eslint-disable-next-line no-unused-vars
function registerRoutes(routesMap, { location, appContext }) {
  const routes = new Map([
    ...routesMap,
    ['/workflow-templates/drafts/edit/:draftId', withAuth(WorkflowTemplateDraftEditor)],
    ['/workflow-templates', withAuth(WorkflowTemplatesList)],
    ['/workflows/drafts/edit/:draftId', withAuth(WorkflowDraftEditor)],
    ['/workflows/published/id/:workflowId/v/:version/instances/id/:instanceId', withAuth(WorkflowInstanceDetailPage)],
    ['/workflows/published/id/:workflowId/v/:version', withAuth(WorkflowDetailPage)],
    ['/workflows', withAuth(WorkflowsList)],
  ]);

  return routes;
}

const plugin = {
  registerRoutes,
};

export default plugin;
