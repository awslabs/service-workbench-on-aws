const { addProductInfo } = require('./default-integration-test-product');

/**
 * A function that performs the complex task of creating a workspace type
 * and configuration.
 */
async function createWorkspaceTypeAndConfiguration(productInfo, adminSession, setup, allowRoleIds = ['admin']) {
  const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });
  const configurationId = setup.gen.string({ prefix: 'configuration-test' });

  await adminSession.resources.workspaceTypes.create(
    addProductInfo({ id: workspaceTypeId, status: 'approved' }, productInfo),
  );
  await adminSession.resources.workspaceTypes
    .workspaceType(workspaceTypeId)
    .configurations()
    .create({ id: configurationId, allowRoleIds });

  return { workspaceTypeId, configurationId };
}

module.exports = { createWorkspaceTypeAndConfiguration };
