/* eslint-disable import/prefer-default-export */
import { httpApiGet, httpApiPost, httpApiPut, httpApiDelete } from '@aws-ee/base-ui/dist/helpers/api';

async function getWorkflowTemplates() {
  return httpApiGet('api/workflow-templates');
}

async function getWorkflowTemplate(id) {
  return httpApiGet(`api/workflow-templates/${encodeURIComponent(id)}`);
}

async function getWorkflowTemplateDrafts() {
  return httpApiGet('api/workflow-templates/drafts');
}

async function createWorkflowTemplateDraft({ isNewTemplate, templateId, templateTitle }) {
  return httpApiPost('api/workflow-templates/drafts', {
    data: {
      isNewTemplate,
      templateId,
      templateTitle,
    },
  });
}

async function updateWorkflowTemplateDraft(draft) {
  return httpApiPut(`api/workflow-templates/drafts/${encodeURIComponent(draft.id)}`, { data: draft });
}

async function publishWorkflowTemplateDraft(draft) {
  return httpApiPost('api/workflow-templates/drafts/publish', { data: draft });
}

async function deleteWorkflowTemplateDraft(draft) {
  return httpApiDelete(`api/workflow-templates/drafts/${encodeURIComponent(draft.id)}`);
}

async function getStepTemplates() {
  return httpApiGet('api/step-templates');
}

async function getWorkflows() {
  return httpApiGet('api/workflows');
}

async function getWorkflowDrafts() {
  return httpApiGet('api/workflows/drafts');
}

async function createWorkflowDraft({ isNewWorkflow, workflowId, templateId }) {
  return httpApiPost('api/workflows/drafts', {
    data: {
      isNewWorkflow,
      workflowId,
      workflowVer: 0,
      templateId,
      templateVer: 0,
    },
  });
}

async function updateWorkflowDraft(draft) {
  return httpApiPut(`api/workflows/drafts/${encodeURIComponent(draft.id)}`, { data: draft });
}

async function publishWorkflowDraft(draft) {
  return httpApiPost('api/workflows/drafts/publish', { data: draft });
}

async function deleteWorkflowDraft(draft) {
  return httpApiDelete(`api/workflows/drafts/${encodeURIComponent(draft.id)}`);
}

async function getWorkflow(id) {
  return httpApiGet(`api/workflows/${encodeURIComponent(id)}`);
}

async function listWorkflowInstancesByStatus({ status, data }) {
  return httpApiPost(`api/workflows/instances/status/${status}`, { data });
}

async function getWorkflowInstances(id, ver) {
  return httpApiGet(`api/workflows/${encodeURIComponent(id)}/v/${ver}/instances`);
}

async function getWorkflowInstance(workflowId, workflowVer, instanceId) {
  return httpApiGet(
    `api/workflows/${encodeURIComponent(workflowId)}/v/${workflowVer}/instances/${encodeURIComponent(instanceId)}`,
  );
}

async function triggerWorkflow(workflowId, workflowVer, data) {
  return httpApiPost(`api/workflows/${encodeURIComponent(workflowId)}/v/${workflowVer}/trigger`, { data });
}

async function getWorkflowAssignments(id) {
  return httpApiGet(`api/workflows/${encodeURIComponent(id)}/assignments`);
}

export {
  getWorkflowTemplates,
  getWorkflowTemplate,
  getWorkflowTemplateDrafts,
  createWorkflowTemplateDraft,
  updateWorkflowTemplateDraft,
  publishWorkflowTemplateDraft,
  deleteWorkflowTemplateDraft,
  getStepTemplates,
  getWorkflows,
  getWorkflowDrafts,
  createWorkflowDraft,
  updateWorkflowDraft,
  publishWorkflowDraft,
  deleteWorkflowDraft,
  getWorkflow,
  listWorkflowInstancesByStatus,
  getWorkflowInstances,
  getWorkflowInstance,
  triggerWorkflow,
  getWorkflowAssignments,
};
