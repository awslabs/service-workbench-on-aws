/* eslint-disable no-await-in-loop */
class AppRunner {
  constructor(appContext) {
    this.appContext = appContext;
  }

  async run() {
    const appContext = this.appContext;
    const registry = appContext.pluginRegistry;
    const initPlugins = registry.getPluginsWithMethod('initialization', 'init');
    const payload = {};

    // Ask each plugin to run init()
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of initPlugins) {
      await plugin.init(payload, appContext);
    }

    // Did any plugin want to do an external redirect?
    if (payload.externalRedirectUrl) {
      window.location = payload.externalRedirectUrl;
      return;
    }

    const postInitPlugins = registry.getPluginsWithMethod('initialization', 'postInit');
    // Ask each plugin to run postInit()
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of postInitPlugins) {
      await plugin.postInit(payload, appContext);
    }

    // Did any plugin want to do an external redirect?
    if (payload.externalRedirectUrl) {
      window.location = payload.externalRedirectUrl;
      return;
    }

    const app = appContext.app;
    await app.init(payload);
  }
}

function registerContextItems(appContext) {
  appContext.appRunner = new AppRunner(appContext);
}

export { AppRunner, registerContextItems };
