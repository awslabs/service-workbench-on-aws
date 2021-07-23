/* eslint-disable import/prefer-default-export */
const enableBuiltInWorkspaces = process.env.REACT_APP_ENABLE_BUILT_IN_WORKSPACES === 'true';
const enableEgressStore = process.env.REACT_APP_ENABLE_EGRESS_STORE;

export { enableBuiltInWorkspaces, enableEgressStore };
