import _ from 'lodash';
import { httpApiGet, httpApiPost, httpApiPut, httpApiDelete } from '@aws-ee/base-ui/dist/helpers/api';
import { removeNulls } from '@aws-ee/base-ui/dist/helpers/utils';

async function getAllEnvTypeCandidatesNotImported() {
  return removeNulls(
    await httpApiGet('api/workspace-type-candidates', { params: { status: 'not-imported', version: '*' } }),
  );
}

async function getLatestEnvTypeCandidatesNotImported() {
  return removeNulls(await httpApiGet('api/workspace-type-candidates', { params: { status: 'not-imported' } }));
}

async function getEnvType(envTypeId) {
  return removeNulls(await httpApiGet(`api/workspace-types/${envTypeId}`));
}

async function getAllEnvTypes() {
  return removeNulls(await httpApiGet('api/workspace-types', { params: { status: '*' } }));
}

async function getApprovedEnvTypes() {
  return removeNulls(await httpApiGet('api/workspace-types', { params: { status: 'approved' } }));
}

async function getNotApprovedEnvTypes() {
  return removeNulls(await httpApiGet('api/workspace-types', { params: { status: 'not-approved' } }));
}

async function createEnvType(envType) {
  // Create request body for the given envType that needs to be created
  const data = {
    id: envType.id,
    name: envType.name,
    desc: envType.desc,
    status: envType.status,
    product: {
      productId: envType.product.productId,
    },
    provisioningArtifact: {
      id: envType.provisioningArtifact.id,
    },
  };
  return removeNulls(await httpApiPost(`api/workspace-types`, { data }));
}

async function updateEnvType(envType) {
  // Create request body for the given envType that needs to be updated
  const data = {
    rev: envType.rev,
    name: envType.name,
    desc: envType.desc,
    status: envType.status,
  };
  return removeNulls(await httpApiPut(`api/workspace-types/${encodeURIComponent(envType.id)}`, { data }));
}

async function deleteEnvType(id) {
  return removeNulls(await httpApiDelete(`api/workspace-types/${encodeURIComponent(id)}`));
}

async function approveEnvType(id, rev) {
  return removeNulls(await httpApiPut(`api/workspace-types/${encodeURIComponent(id)}/approve`, { data: { rev } }));
}

async function revokeEnvType(id, rev) {
  return removeNulls(await httpApiPut(`api/workspace-types/${encodeURIComponent(id)}/revoke`, { data: { rev } }));
}

async function getEnvTypeConfigs(envTypeId) {
  // return env type configurations that the caller is allowed to use
  return removeNulls(await httpApiGet(`api/workspace-types/${encodeURIComponent(envTypeId)}/configurations`));
}
async function getAllEnvTypeConfigs(envTypeId) {
  // return all env type configurations (applicable only for admins) irrespective of what's specified in allow/deny
  // user roles. For non-admins this is same as "getEnvTypeConfigs" i.e., the extra include=all does not do anything
  // for regular (non-admin) users
  return removeNulls(
    await httpApiGet(`api/workspace-types/${encodeURIComponent(envTypeId)}/configurations?include=all`),
  );
}

async function createEnvTypeConfig(envTypeId, envTypeConfig) {
  return removeNulls(
    await httpApiPost(`api/workspace-types/${encodeURIComponent(envTypeId)}/configurations`, {
      data: _.omit(envTypeConfig, ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'allowedToUse']),
    }),
  );
}

async function updateEnvTypeConfig(envTypeId, envTypeConfig) {
  return removeNulls(
    await httpApiPut(
      `api/workspace-types/${encodeURIComponent(envTypeId)}/configurations/${decodeURIComponent(envTypeConfig.id)}`,
      { data: _.omit(envTypeConfig, ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'allowedToUse']) },
    ),
  );
}

async function deleteEnvTypeConfig(envTypeId, envTypeConfigId) {
  return removeNulls(
    await httpApiDelete(
      `api/workspace-types/${encodeURIComponent(envTypeId)}/configurations/${encodeURIComponent(envTypeConfigId)}`,
    ),
  );
}

async function getEnvTypeConfigVars(envTypeId) {
  return removeNulls(await httpApiGet(`api/workspace-types/${encodeURIComponent(envTypeId)}/config-vars`));
}

export {
  // Env type candidates
  getAllEnvTypeCandidatesNotImported,
  getLatestEnvTypeCandidatesNotImported,
  // Env types
  getAllEnvTypes,
  getApprovedEnvTypes,
  getNotApprovedEnvTypes,
  getEnvType,
  createEnvType,
  updateEnvType,
  deleteEnvType,
  approveEnvType,
  revokeEnvType,
  // Env type configs
  getEnvTypeConfigs,
  getAllEnvTypeConfigs,
  createEnvTypeConfig,
  updateEnvTypeConfig,
  deleteEnvTypeConfig,
  // Env type config variables
  getEnvTypeConfigVars,
};
