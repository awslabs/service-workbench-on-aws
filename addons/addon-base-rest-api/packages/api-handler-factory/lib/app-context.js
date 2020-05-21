const _ = require('lodash');
const express = require('express');
const Boom = require('@aws-ee/base-services-container/lib/boom');

class AppContext {
  constructor({ app, settings, log, servicesContainer }) {
    this.app = app;
    this.settings = settings;
    this.log = log;
    this.container = servicesContainer;
    this.boom = new Boom();
  }

  async service(nameOrNames) {
    const result = [];
    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const name of _.concat(nameOrNames)) {
      const service = await this.container.find(name);
      if (!service) throw new Error(`The "${name}" service is not available.`);
      result.push(service);
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    if (!_.isArray(nameOrNames)) return _.head(result);
    return result;
  }

  async optionalService(nameOrNames) {
    const result = [];
    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const name of _.concat(nameOrNames)) {
      const service = await this.container.find(name);
      result.push(service);
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    if (!_.isArray(nameOrNames)) return _.head(result);
    return result;
  }

  wrap(fn) {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (err) {
        next(err);
      }
    };
  }

  router() {
    return express.Router();
  }
}

module.exports = AppContext;
