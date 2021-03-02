/**
 * A function that performs the complex task of creating a workspace type
 * and configuration.
 *
 * @param {Session} adminSession The admin session.
 * @param {Setup} setup The setup object.
 * @param {Array} allowRoledIds The roles allowed to launch the workspace.
 */
async function createWorkspaceTypeAndConfiguration(adminSession, setup, allowRoleIds = ['admin']) {
  const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });
  const configurationId = setup.gen.string({ prefix: 'configuration-test' });

  await adminSession.resources.workspaceTypes.create({ id: workspaceTypeId, status: 'approved' });
  await adminSession.resources.workspaceTypes
    .workspaceType(workspaceTypeId)
    .configurations()
    .create({ id: configurationId, allowRoleIds });

  return { workspaceTypeId, configurationId };
}

module.exports = { createWorkspaceTypeAndConfiguration };
