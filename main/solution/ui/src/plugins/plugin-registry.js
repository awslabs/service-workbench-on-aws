import baseAppContextItemsPlugin from '@aws-ee/base-ui/dist/plugins/app-context-items-plugin';
import baseInitializationPlugin from '@aws-ee/base-ui/dist/plugins/initialization-plugin';
import baseAuthenticationPlugin from '@aws-ee/base-ui/dist/plugins/authentication-plugin';
import baseAppComponentPlugin from '@aws-ee/base-ui/dist/plugins/app-component-plugin';
import baseMenuItemsPlugin from '@aws-ee/base-ui/dist/plugins/menu-items-plugin';
import baseRoutesPlugin from '@aws-ee/base-ui/dist/plugins/routes-plugin';
import workflowAppContextItemsPlugin from '@aws-ee/base-workflow-ui/dist/plugins/app-context-items-plugin';
import workflowMenuItemsPlugin from '@aws-ee/base-workflow-ui/dist/plugins/menu-items-plugin';
import workflowRoutesPlugin from '@aws-ee/base-workflow-ui/dist/plugins/routes-plugin';
import raasAppContextItemsPlugin from '@aws-ee/base-raas-ui/dist/plugins/app-context-items-plugin';
import raasInitializationPlugin from '@aws-ee/base-raas-ui/dist/plugins/initialization-plugin';
import raasAppComponentPlugin from '@aws-ee/base-raas-ui/dist/plugins/app-component-plugin';
import raasMenuItemsPlugin from '@aws-ee/base-raas-ui/dist/plugins/menu-items-plugin';
import raasRoutesPlugin from '@aws-ee/base-raas-ui/dist/plugins/routes-plugin';

import appContextItemsPlugin from './app-context-items-plugin';
import initializationPlugin from './initialization-plugin';
import menuItemsPlugin from './menu-items-plugin';
import routesPlugin from './routes-plugin';

// baseAppContextItemsPlugin registers app context items (such as base MobX stores etc) provided by the base addon
// baseInitializationPlugin registers the base initialization logic provided by the base ui addon
// baseMenuItemsPlugin registers menu items provided by the base addon
// baseRoutesPlugin registers base routes provided by the base addon
const extensionPoints = {
  'app-context-items': [
    baseAppContextItemsPlugin,
    workflowAppContextItemsPlugin,
    raasAppContextItemsPlugin,
    appContextItemsPlugin,
  ],
  'initialization': [baseInitializationPlugin, raasInitializationPlugin, initializationPlugin],
  'authentication': [baseAuthenticationPlugin],
  'app-component': [baseAppComponentPlugin, raasAppComponentPlugin],
  'menu-items': [baseMenuItemsPlugin, workflowMenuItemsPlugin, raasMenuItemsPlugin, menuItemsPlugin],
  'routes': [baseRoutesPlugin, workflowRoutesPlugin, raasRoutesPlugin, routesPlugin],
};

function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

export default registry;
