import { getSnapshot, types } from 'mobx-state-tree';

const InstanceInfo = types
  .model('InstanceInfo', {
    Ec2WorkspaceDnsName: '',
    type: '',
    size: '',
    JupyterUrl: '',
    NotebookInstanceName: '',
    s3Mounts: '',
    iamPolicyDocument: '',
    environmentInstanceFiles: '',
  })
  .views(self => ({
    get id() {
      return self.identifierStr;
    },
    get identifier() {
      return self;
    },
    get identifierStr() {
      return JSON.stringify(getSnapshot(self));
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { InstanceInfo };
