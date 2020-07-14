import { types, applySnapshot, getEnv } from 'mobx-state-tree';

// ====================================================================================================================================
// EnvTypeConfigVar
// ====================================================================================================================================
const EnvTypeConfigVar = types
  .model('EnvTypeConfigVar', {
    name: '',
    desc: '',
  })
  .actions(self => ({
    setEnvTypeConfigVar(envTypeConfigVar) {
      applySnapshot(self, envTypeConfigVar);
    },
  }))
  .views(self => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },
  }));

export default EnvTypeConfigVar;
export { EnvTypeConfigVar };
