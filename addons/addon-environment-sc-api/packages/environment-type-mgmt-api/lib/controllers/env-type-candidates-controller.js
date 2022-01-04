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

const envTypeCandidateStatusEnum = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-candidate-status-enum');
const versionFilterEnum = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-candidate-version-filter-enum');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const boom = context.boom;

  /**
   * A utility method that converts the given query string "status" parameter
   * and "includeVersion" to an appropriate filter status value that the service expects.
   *
   * @param queryStatus
   * @param queryVersionFilter
   * @returns {*[]} An array of status values to filter on
   */
  function toFilter(queryStatus, queryVersionFilter) {
    // The service is expecting filter.status to be an array of status values to filter on (i.e., return all
    // env type candidates matching any status specified in the filter)
    //
    // Convert the query string param "status" to an array if it's not an array
    // The API will allow caller passing "status" as an array or as a comma separated string
    // containing allowed status values
    const filter = {};
    if (_.isArray(queryStatus)) {
      filter.status = queryStatus;
    } else if (_.isString(queryStatus) && _.includes(queryStatus, ',')) {
      filter.status = _.split(queryStatus, ',');
    } else {
      // if no status is specified then only return env type candidates that have not been imported yet
      filter.status = [queryStatus || envTypeCandidateStatusEnum.notImported];
    }
    filter.version = queryVersionFilter || versionFilterEnum.latest;

    return filter;
  }

  // ===============================================================
  //  GET / (mounted to /api/workspace-type-candidates)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeCandidateService']);

      const list = await envTypeService.list(requestContext, {
        filter: toFilter(req.query.status, req.query.version),
      });
      const portfolioId = await envTypeService.getPortfolioId();
      const results = { list, portfolioId };
      res.status(200).json(results);
    }),
  );

  return router;
}
module.exports = configure;
