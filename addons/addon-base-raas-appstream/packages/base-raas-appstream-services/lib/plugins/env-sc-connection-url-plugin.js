/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const _ = require('lodash');

async function createConnectionUrl({ envId, connection }, { requestContext, container }) {
  const log = await container.find('log');
  // Only wraps web urls via app stream (i.e., scheme = 'http' or 'https' or no scheme)
  const isHttp = connection.scheme === 'http' || connection.scheme === 'https' || _.isEmpty(connection.scheme);

  // Only wrap via AppStream if the connection.url exists
  let appStreamUrl;
  if (isHttp && connection.url) {
    log.debug({
      msg: `Target connection URL ${connection.url} will be made available for pasting into AppStream`,
      connection,
    });
    const appStreamScService = await container.find('appStreamScService');
    appStreamUrl = await appStreamScService.urlForFirefox(requestContext, {
      environmentId: envId,
      finalDestination: connection.url,
    });
  } else if (connection.scheme === 'rdp') {
    log.debug({
      msg: `Will stream target RDP connection for instance ${connection.instanceId} via AppStream`,
      connection,
    });
    const appStreamScService = await container.find('appStreamScService');
    appStreamUrl = await appStreamScService.urlForRemoteDesktop(requestContext, {
      environmentId: envId,
      instanceId: connection.instanceId,
    });
  }

  if (appStreamUrl) {
    connection.scheme = 'https';
    // Retain the original destination URL so we don't have to trigger another API call
    connection.appstreamDestinationUrl = connection.url;

    // Now rewrite connection.url to the AppStream streaming URL so it can opened in a new tab
    connection.url = appStreamUrl;
    log.debug({ msg: `Modified connection to use AppStream streaming URL ${connection.url}`, connection });
  }

  return { envId, connection };
}

const plugin = { createConnectionUrl };

module.exports = plugin;
