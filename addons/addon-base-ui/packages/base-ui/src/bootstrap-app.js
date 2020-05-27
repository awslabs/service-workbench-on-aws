/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import { configure } from 'mobx';
import 'mobx-react/batchingForReactDom';
import { initializeAppContext } from './app-context/app-context';

import * as serviceWorker from './service-worker';
import AppContainer from './AppContainer';

function bootstrapApp({ renderAppContainer, renderError, renderProgress, pluginRegistry }) {
  // Disabling service worker
  serviceWorker.unregister();

  // Enable mobx strict mode, changes to state must be contained in actions
  configure({ enforceActions: 'always' });

  // Initialize appContext object registering various Mobx stores etc
  const appContext = initializeAppContext(pluginRegistry);

  // Render page loading message
  renderProgress();

  // Trigger the app startup sequence
  (async () => {
    try {
      await appContext.appRunner.run();
      renderAppContainer(AppContainer, appContext);
    } catch (err) {
      console.log(err);
      // TODO - check if the code = tokenExpired, then
      // - render a notification error
      // - call cleaner cleanup, this is IMPORTANT
      // - render the app and skip the rest of the renderError logic
      // - doing the above logic will help us have a smooth user experience
      //   when the token has expired. NOTE: this might not be applicable for the
      //   cases where the app requires midway before anything is displayed to the user
      renderError(err);
      try {
        appContext.cleaner.cleanup();
      } catch (error) {
        // ignore
        console.log(error);
      }
    }
  })();
}

export default bootstrapApp;
