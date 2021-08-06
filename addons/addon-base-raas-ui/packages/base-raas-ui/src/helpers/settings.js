/* eslint-disable import/prefer-default-export */
const enableBuiltInWorkspaces = process.env.REACT_APP_ENABLE_BUILT_IN_WORKSPACES === 'true';
const enableEgressStore = process.env.REACT_APP_ENABLE_EGRESS_STORE;
const isAppStreamEnabled = process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true';

export { enableBuiltInWorkspaces, enableEgressStore, isAppStreamEnabled };
