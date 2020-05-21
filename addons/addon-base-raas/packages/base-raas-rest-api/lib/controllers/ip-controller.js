const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // ===============================================================
  //  GET / (mounted to /api/ip)
  // ===============================================================
  router.get(
    '',
    wrap(async (req, res) => {
      const ipString =
        req.header('X-Forwarded-For') ||
        _.get(req, 'requestContext.identity.sourceIp') ||
        _.get(req, 'connection.remoteAddress');

      // Note, by definition, the information in the 'X-Forwarded-For' should never
      // be trusted as authoritative and should never be used for any kind of verification.
      // Sometime 'X-Forwarded-For' can be an string with ', ' if there were multiple forwards.
      // We take the first element.
      res.status(200).json({
        ipAddress: _.trim(_.first(_.split(ipString, ','))),
      });
    }),
  );

  return router;
}

module.exports = configure;
