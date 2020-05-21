const _ = require('lodash');

const logError = console.error; // eslint-disable-line no-console

module.exports = () => (err, req, res, next) => {
  if (!_.isError(err)) {
    next();
    return;
  }

  const httpStatus = _.get(err, 'status', 500);

  // see https://github.com/dougmoscrop/serverless-http/blob/master/docs/ADVANCED.md
  const requestId = _.get(req, 'x-request-id', '');
  const code = _.get(err, 'code', 'UNKNOWN');
  const root = _.get(err, 'root');
  const safe = _.get(err, 'safe', false);

  if (httpStatus >= 500) {
    // we print the error only if it is an internal server error
    if (root) logError(root);
    logError(err);
  }
  const errorMessage = err.message;

  const responseBody = {
    requestId,
    code,
    // if there is error message and if it is safe to include then include it in http response
    message: safe && errorMessage ? errorMessage : 'Something went wrong',
  };
  const payload = err.payload;
  // if there is error payload object and if it is safe to include then include it in http response
  if (safe && payload) {
    responseBody.payload = payload;
  }

  res.set('X-Request-Id-2', requestId);
  res.status(httpStatus).json(responseBody);
};
