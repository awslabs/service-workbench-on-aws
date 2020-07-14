const _ = require('lodash');

const envTypeStatusEnum = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-status-enum');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

  /**
   * A utility method that converts the given query string "status" parameter to an appropriate filter status value
   * that the service expects.
   *
   * @param queryStatus
   * @returns {*[]} An array of status values to filter on
   */
  function toFilterStatus(queryStatus) {
    // The service is expecting filter.status to be an array of status values to filter on (i.e., return all
    // env types matching any status specified in the filter)
    //
    // Convert the query string param "status" to an array if it's not an array
    // The API will allow caller passing "status" as an array or as a comma separated string
    // containing allowed status values
    let filterStatus;
    if (_.isArray(queryStatus)) {
      filterStatus = queryStatus;
    } else if (_.isString(queryStatus) && _.includes(queryStatus, ',')) {
      filterStatus = _.split(queryStatus, ',');
    } else {
      // if no status is specified then filter approved env types by default
      filterStatus = [queryStatus || envTypeStatusEnum.approved];
    }
    return filterStatus;
  }

  function assertOnlyRevInBody(requestBody) {
    const extraParams = _.difference(_.keys(requestBody), ['rev']);
    if (extraParams.length !== 0) {
      // Only expecting "rev" in the approve API, reject call if anything else is passed
      throw boom.badRequest(`Invalid request, unknown request parameters ${_.join(extraParams, ', ')}`, true);
    }
  }

  // ===============================================================
  //  GET / (mounted to /api/workspace-types)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);

      const list = await envTypeService.list(requestContext, {
        filter: { status: toFilterStatus(req.query.status) },
      });
      res.status(200).json(list);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/workspace-types)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);

      const result = await envTypeService.create(requestContext, req.body);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET / (mounted to /api/workspace-types)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);

      const envType = await envTypeService.mustFind(requestContext, { id: req.params.id });
      res.status(200).json(envType);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/workspace-types)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);
      if (req.body.id && req.params.id !== req.body.id) {
        throw boom.badRequest(`The id in the request body does not match with the one in the path`, true);
      }
      const envType = req.body;
      envType.id = req.params.id;
      const result = await envTypeService.update(requestContext, envType);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE / (mounted to /api/workspace-types)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);

      await envTypeService.delete(requestContext, { id: req.params.id });
      res.status(200).json({});
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/workspace-types)
  // ===============================================================
  router.put(
    '/:id/approve',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);
      assertOnlyRevInBody(req.body);
      const result = await envTypeService.approve(requestContext, { id: req.params.id, rev: req.body.rev });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/workspace-types)
  // ===============================================================
  router.put(
    '/:id/revoke',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeService] = await context.service(['envTypeService']);
      assertOnlyRevInBody(req.body);
      const result = await envTypeService.revoke(requestContext, { id: req.params.id, rev: req.body.rev });
      res.status(200).json(result);
    }),
  );

  return router;
}
module.exports = configure;
