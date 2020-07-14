import { types, getEnv, applySnapshot } from 'mobx-state-tree';

// ====================================================================================================================================
// Product -- Maps to AWS Service Catalog Product (only id and name)
// ====================================================================================================================================
const Product = types.model('Product', {
  productId: '',
  name: '',
});

// ====================================================================================================================================
// ProvisioningArtifact -- Maps to AWS Service Catalog Provisioning Artifact (a.k.a., Version)
// ====================================================================================================================================
const ProvisioningArtifact = types.model('ProvisioningArtifact', {
  id: '',
  name: types.maybeNull(types.optional(types.string, '')),
  description: types.maybeNull(types.optional(types.string, '')),
  type: '',
  createdTime: '',
  active: false,
  guidance: '',
});

// ====================================================================================================================================
// ParamConstraint -- Maps to AWS Service Catalog Provisioning Artifact Parameter Constraints
// ====================================================================================================================================
const ParamConstraint = types.model('ParamConstraint', {
  AllowedValues: types.optional(types.array(types.optional(types.string, '')), []),
});

// ====================================================================================================================================
// CfnParam -- Maps to AWS Service Catalog Provisioning Artifact Parameters - in turn maps to AWS CloudFormation Stack Input Parameters
// ====================================================================================================================================
const CfnParam = types.model('CfnParam', {
  ParameterKey: '',
  ParameterType: '',
  IsNoEcho: false,
  Description: types.maybeNull(types.optional(types.string, '')),
  ParameterConstraints: types.optional(ParamConstraint, {}),
});

// ====================================================================================================================================
// EnvTypeCandidate
// ====================================================================================================================================
const EnvTypeCandidate = types
  .model('EnvTypeCandidate', {
    id: types.identifier,
    name: '',
    desc: types.maybeNull(types.optional(types.string, '')),
    isLatest: false,
    product: types.optional(Product, {}),
    provisioningArtifact: types.optional(ProvisioningArtifact, {}),
    params: types.optional(types.array(CfnParam), []),
  })
  .actions(self => ({
    setEnvTypeCandidate(envTypeCandidate) {
      applySnapshot(self, envTypeCandidate);
    },
  }))
  .views(self => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },
  }));
export default EnvTypeCandidate;
export { EnvTypeCandidate };
