const _ = require('lodash');

const BoomError = require('./boom-error');

class Boom {
  constructor() {
    this.extend(
      ['badRequest', 400],
      ['concurrentUpdate', 400],
      // Make sure you know the difference between forbidden and unauthorized
      // (see https://stackoverflow.com/questions/3297048/403-forbidden-vs-401-unauthorized-http-responses)
      ['unauthorized', 401],
      ['forbidden', 403],
      ['invalidToken', 403],
      ['notFound', 404],
      ['alreadyExists', 400],
      // Used when a conflicting operation is being performed (e.g. updating an item when a newer
      // revision of the same is updated by someone else before that)
      ['outdatedUpdateAttempt', 409],
      ['timeout', 408],
      ['badImplementation', 500],
      ['internalError', 500],
    );
  }

  extend(...arr) {
    _.forEach(arr, item => {
      if (!_.isArray(item))
        throw new Error(
          `You tried to extend boom, but one of the elements you provided is not an array "${item}". You need to pass an array of arrays.`,
        );
      this[item[0]] = (msg, safe) => new BoomError(msg, safe, item[0], item[1]);
    });
  }

  is(error, code) {
    return (error || {}).boom && error.code === code;
  }

  code(error) {
    return (error || {}).code || '';
  }
}

module.exports = Boom;
