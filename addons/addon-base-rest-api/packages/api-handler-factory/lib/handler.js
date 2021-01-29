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

const _ = require('lodash');
const express = require('express');
const serverless = require('serverless-http');
const compression = require('compression');
const bodyParser = require('body-parser');
const cors = require('cors');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

const errorHandler = require('./error-handler');
const AppContext = require('./app-context');

let cachedHandler;

// registerServices = fn (required)
// registerRoutes = fn (required)
function handlerFactory({ registerServices, registerRoutes }) {
  return async (event, context) => {
    if (cachedHandler) return cachedHandler(event, context);

    const apiRouter = express.Router({ mergeParams: true });
    const app = express();
    app.disable('x-powered-by');

    // register services
    const servicesContainer = new ServicesContainer(['settings', 'log']);
    await registerServices(servicesContainer);
    await servicesContainer.initServices();

    // check circular dependencies
    const servicesList = servicesContainer.validate();

    // resolve settings and log services
    const logger = await servicesContainer.find('log');
    const settingsService = await servicesContainer.find('settings');

    // create app context
    const appContext = new AppContext({ app, settings: settingsService, log: logger, servicesContainer });

    // register routes
    await registerRoutes(appContext, apiRouter);

    // setup CORS, compression and body parser
    const isDev = settingsService.get('envType') === 'dev';
    let allowList = settingsService.optionalObject('corsAllowList', []);
    if (isDev) allowList = _.concat(allowList, settingsService.optionalObject('corsAllowListLocal', []));
    const corsOptions = {
      origin: (origin, callback) => {
        if (allowList.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    };
    app.use(compression());
    app.use(cors(corsOptions));
    app.use(bodyParser.json({ limit: '50mb' })); // see https://stackoverflow.com/questions/19917401/error-request-entity-too-large
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); // for parsing application/x-www-form-urlencoded

    // log all incoming requests
    app.use((req, res, next) => {
      logger.info({
        logEventType: 'incomingRequest', // static field useful for filtering logs
        uid: _.get(req, 'context.authorizer.uid'),
        authenticationProviderId: _.get(req, 'context.authorizer.authenticationProviderId'),
        method: req.method,
        url: req.url,
        query: req.query,
        body: req.body,
      });
      next();
    });

    // mount all routes under /
    app.use('/', apiRouter);

    // add global error handler
    app.use(errorHandler());

    // allow options for all
    app.options('*');

    // prepare the handler
    cachedHandler = serverless(app, {
      callbackWaitsForEmptyEventLoop: true,
      request(req, { requestContext = {} }) {
        // expose the lambda event request context
        req.context = requestContext;
      },
    });

    // print useful information
    const settingsList = settingsService.entries;

    logger.info('Settings available are :');
    logger.info(settingsList);

    logger.info('Services available are :');
    logger.info(servicesList);

    return cachedHandler(event, context);
  };
}

module.exports = handlerFactory;
