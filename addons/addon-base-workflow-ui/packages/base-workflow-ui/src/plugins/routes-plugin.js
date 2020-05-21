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
