import { types } from 'mobx-state-tree';
import _ from 'lodash';

import { getAuthenticationProviderConfigs, updateAuthenticationProviderConfig } from '../../helpers/api';
import { BaseStore } from '../BaseStore';
import { flattenObject, mapToArray, unFlattenObject } from '../../helpers/utils';
import ConfigurationEditor from '../configuration/ConfigurationEditor';
import AuthenticationProviderConfigEditor from './AuthenticationProviderConfigEditor';

const AuthenticationProviderConfigsStore = BaseStore.named('AuthenticationProviderConfigsStore')
  .props({
    // authenticationProviderConfigs: A map of authentication provider configurations. Key = id, Value = authn provider config
    // Each config in the array has the following shape
    /*
    {
      id: STRING // id of the authentication provider
      title: STRING // title of the authentication provider
      ..... // The rest of the fields which differ depending on the type of the authentication provider
      type: { // An object containing information about the authentication provider type
        type: STRING // authentication provider type
        title: STRING // title of the authentication provider type
        description: STRING // description about the authentication provider type
        config: { // An object authentication provider type configuration
          credentialHandlingType: STRING // credentialHandlingType indicating credential handling for the authentication provider
                                         // Possible values:
                                         // 'submit' -- The credentials should be submitted to the URL provided by the authentication provider
                                         // 'redirect' -- The credentials should be NOT be collected and the user should be redirected directly to the
                                         // URL provided by the authentication provider. For example, in case of SAML auth, the username/password
                                         // should not be collected by the service provider but the user should be redirected to the identity provider

          inputSchema: OBJECT // An object containing JSON schema that describes all properties of the authentication provider configuration that must be provided as
                              // input when creating this authentication provider.
                              // This schema will defer based on authentication provider type.
          inputManifestForCreate: OBJECT // An object similar to inputSchema containing a manifest that describes all properties of the authentication provider configuration that must be provided as
                              // input when creating this authentication provider. In addition, the object also has information that can be used by the UI to display inputs
                              // forms such as which inputs to ask from user in which section of the wizard, which sections to show based on which conditions etc.
                              // This manifest will defer based on authentication provider type.
          inputManifestForUpdate: OBJECT // Similar to inputManifestForCreate that describes inputs to be accepted from user when updating an existing authentication provider
        }
      }
    }
    */
    authenticationProviderConfigs: types.optional(types.map(types.frozen()), {}),

    /*
      Key = authenticationProviderConfigId, Value = AuthenticationProviderConfigEditor
     */
    authenticationProviderConfigEditors: types.optional(types.map(AuthenticationProviderConfigEditor), {}),
  })
  .actions(self => ({
    async doLoad() {
      const authenticationProviderConfigs = await getAuthenticationProviderConfigs();
      self.runInAction(() => {
        const map = {};
        authenticationProviderConfigs.forEach(authenticationProviderConfig => {
          map[authenticationProviderConfig.id] = authenticationProviderConfig;
        });
        self.authenticationProviderConfigs.replace(map);
      });
    },

    getUpdateAuthenticationProviderConfigEditor(authenticationProviderConfigId) {
      let authenticationProviderConfigEditor = self.authenticationProviderConfigEditors.get(
        authenticationProviderConfigId,
      );
      if (!authenticationProviderConfigEditor) {
        authenticationProviderConfigEditor = AuthenticationProviderConfigEditor.create({
          id: authenticationProviderConfigId,
        });
        const authenticationProviderConfig = self.getAuthenticationProviderConfig(authenticationProviderConfigId);
        authenticationProviderConfigEditor.setConfigEditor(self.getConfigEditorForUpdate(authenticationProviderConfig));

        self.authenticationProviderConfigEditors.put(authenticationProviderConfigEditor);
      }
      return authenticationProviderConfigEditor;
    },

    getConfigEditorForUpdate(authenticationProviderConfig) {
      const inputManifestForUpdate = authenticationProviderConfig.config.type.config.inputManifestForUpdate;
      if (inputManifestForUpdate) {
        const inputManifest = _.cloneDeep(inputManifestForUpdate);
        // "id" is read-only and should not be part of the inputManifestForUpdate when updating an existing provider so remove it
        const filteredSections = _.map(inputManifest.sections, section => {
          const filteredChildren = _.filter(section.children, child => child.name !== 'id');
          section.children = filteredChildren;
          return section;
        });
        inputManifest.sections = filteredSections;

        const configuration = toConfiguration(authenticationProviderConfig.config);
        return ConfigurationEditor.create({
          currentSectionIndex: 0,
          review: false,
          inputManifest,
          configuration,
          mode: 'edit',
        });
      }
      return undefined;
    },

    async updateAuthenticationProvider(authenticationProviderConfig) {
      const updated = await updateAuthenticationProviderConfig(authenticationProviderConfig);
      self.runInAction(() => {
        self.authenticationProviderConfigs.set(updated.id, updated);
        const authenticationProviderConfigEditor = self.authenticationProviderConfigEditors.get(updated.id);
        authenticationProviderConfigEditor.setConfigEditor(self.getConfigEditorForUpdate(updated));
      });
    },

    getCreateAuthenticationProviderConfigEditor(_authenticationProviderTypeConfig) {},
  }))
  .views(self => ({
    get empty() {
      return self.authenticationProviderConfigs.size === 0;
    },
    get list() {
      return mapToArray(self.authenticationProviderConfigs);
    },
    getAuthenticationProviderConfig(authenticationProviderConfigId) {
      return self.authenticationProviderConfigs.get(authenticationProviderConfigId);
    },

    /**
     * Method that finds first authentication provider that has an idp with the given idp name
     * @param idpName Name of the identity provider
     * @returns {*}
     */
    getAuthenticationProviderConfigByIdpName(idpName) {
      const providerConfig = _.find(self.list, authNProvider => {
        const idps = _.get(authNProvider, 'config.federatedIdentityProviders');
        const foundIdp = _.find(idps, { name: idpName });
        // return true if idp is found under this authentication provider
        return !!foundIdp;
      });
      return providerConfig;
    },
  }));
/**
 * Translates given authenticationProviderConfig into ConfigurationEditor compatible flat "configuration" object with key/value pairs.
 * The authenticationProviderConfig may be an object graph but the returned "configuration" will be flat object with key/value pairs.
 * @param authenticationProviderConfig
 * @return configuration
 */
function toConfiguration(authenticationProviderConfig) {
  // Authentication provider "type" information is not part of inputs and can be skipped from the configuration
  const flatObj = flattenObject(authenticationProviderConfig, (_result, _value, key) => key !== 'type');

  // MobX form tries to handle nested object notations using dots and and array notations using
  // [] and expects nested field structure
  // Here, we want the keys like 'a.b[0].c[1]' etc to be treated as opaque keys in MobX
  // So replace . and [] to make sure mobx does not treat them as nested keys
  const toOpaqueKey = key => {
    let opaqueKey = _.replace(key, /\./g, '/');
    opaqueKey = _.replace(opaqueKey, /\[/g, '|-');
    opaqueKey = _.replace(opaqueKey, /]/g, '-|');
    return opaqueKey;
  };
  return _.transform(
    flatObj,
    (result, value, key) => {
      result[toOpaqueKey(key)] = value;
    },
    {},
  );
}

/**
 * Translates given configuration object containing key/value pairs into authenticationProviderConfig.
 * This function is inverse of toConfiguration function above.
 * @param configuration
 * @return authenticationProviderConfig
 */
function fromConfiguration(configuration) {
  // MobX form tries to handle nested object notations using dots and and array notations using
  // [] and expects nested field structure
  // Here, the configuration may have been translated to use opaque keys with dots replaced by / and
  // [ replaced by |- and ] replaced with -|
  // Convert those keys back to use dot and [] notations
  const fromOpaqueKey = key => {
    let opaqueKey = _.replace(key, /\//g, '.');
    opaqueKey = _.replace(opaqueKey, /(\|-)/g, '[');
    opaqueKey = _.replace(opaqueKey, /(-\|)/g, ']');
    return opaqueKey;
  };

  const flatObj = _.transform(
    configuration,
    (result, value, key) => {
      result[fromOpaqueKey(key)] = value;
    },
    {},
  );

  // Authentication provider "type" information is not part of inputs and can be skipped from the configuration
  return unFlattenObject(flatObj, (_result, _value, key) => key !== 'type');
}

function registerContextItems(appContext) {
  appContext.authenticationProviderConfigsStore = AuthenticationProviderConfigsStore.create({}, appContext);
}

export { AuthenticationProviderConfigsStore, registerContextItems, fromConfiguration };
