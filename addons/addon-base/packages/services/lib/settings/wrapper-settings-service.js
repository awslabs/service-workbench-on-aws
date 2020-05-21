const Service = require('@aws-ee/base-services-container/lib/service');

class SettingsService extends Service {
  constructor(settings) {
    super();
    this._original = settings;
  }

  get entries() {
    return this._original.entries;
  }

  set(key, value) {
    this._original.set(key, value);
  }

  get(key) {
    return this._original.get(key);
  }

  getObject(key) {
    return this._original.getObject(key);
  }

  getBoolean(key) {
    return this._original.getBoolean(key);
  }

  getNumber(key) {
    return this._original.getNumber(key);
  }

  optional(key, defaultValue) {
    return this._original.optional(key, defaultValue);
  }

  optionalObject(key, defaultValue) {
    return this._original.optionalObject(key, defaultValue);
  }

  optionalNumber(key, defaultValue) {
    return this._original.optionalNumber(key, defaultValue);
  }

  optionalBoolean(key, defaultValue) {
    return this._original.optionalBoolean(key, defaultValue);
  }
}

module.exports = SettingsService;
