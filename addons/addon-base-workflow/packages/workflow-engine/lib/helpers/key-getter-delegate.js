const _ = require('lodash');

class KeyGetterDelegate {
  constructor(findFnAsync, { loadFn, storeTitle = '' } = {}) {
    this.findFnAsync = findFnAsync;
    this.storeTitle = storeTitle;
    this.loadFn = loadFn;
  }

  async string(key) {
    const value = await this.mustFind(key);
    if (!_.isString(value) || _.isEmpty(value))
      throw new Error(`${this.storeTitle} key "${key}" is not a string or is null or is empty, value = [${value}].`);

    return value;
  }

  async number(key) {
    const value = await this.mustFind(key);
    if (!_.isNumber(value)) throw new Error(`${this.storeTitle} key "${key}" is not a number, value = [${value}].`);

    return value;
  }

  async boolean(key) {
    const value = await this.mustFind(key);
    if (!_.isBoolean(value)) throw new Error(`${this.storeTitle} key "${key}" is not a boolean, value = [${value}].`);

    return value;
  }

  async object(key) {
    const value = await this.mustFind(key);
    if (!_.isObject(value)) throw new Error(`${this.storeTitle} key "${key}" is not an object, value = [${value}].`);

    return value;
  }

  async array(key) {
    const value = await this.mustFind(key);
    if (!_.isArray(value)) throw new Error(`${this.storeTitle} key "${key}" is not an array, value = [${value}].`);

    return value;
  }

  async optionalString(key, defaults = '') {
    const value = await this.value(key);
    if (_.isNil(value)) return defaults;
    if (!_.isString(value)) throw new Error(`${this.storeTitle} key "${key}" is not a string, value = [${value}].`);
    if (_.isEmpty(value)) return defaults;

    return value;
  }

  async optionalNumber(key, defaults = NaN) {
    const value = await this.value(key);
    if (_.isNil(value)) return defaults;
    if (!_.isNumber(value)) throw new Error(`${this.storeTitle} key "${key}" is not a number, value = [${value}].`);

    return value;
  }

  async optionalBoolean(key, defaults = false) {
    const value = await this.value(key);
    if (_.isNil(value)) return defaults;
    if (!_.isBoolean(value)) throw new Error(`${this.storeTitle} key "${key}" is not a boolean, value = [${value}].`);

    return value;
  }

  async optionalObject(key, defaults = {}) {
    const value = await this.value(key);
    if (_.isNil(value)) return defaults;
    if (!_.isObject(value)) throw new Error(`${this.storeTitle} key "${key}" is not an object, value = [${value}].`);

    return value;
  }

  async optionalArray(key, defaults = []) {
    const value = await this.value(key);
    if (_.isNil(value)) return defaults;
    if (!_.isArray(value)) throw new Error(`${this.storeTitle} key "${key}" is not an array, value = [${value}].`);

    return value;
  }

  // Returns the getter methods (bounded to this KeyGetterDelegate instance)
  // This is useful if you have your own Store class and you want to add to your store
  // the getter methods of this KeyGetterDelegate
  getMethods() {
    return {
      string: this.string.bind(this),
      number: this.number.bind(this),
      boolean: this.boolean.bind(this),
      object: this.object.bind(this),
      array: this.array.bind(this),

      optionalString: this.optionalString.bind(this),
      optionalNumber: this.optionalNumber.bind(this),
      optionalBoolean: this.optionalBoolean.bind(this),
      optionalObject: this.optionalObject.bind(this),
      optionalArray: this.optionalArray.bind(this),
    };
  }

  // private
  async value(key) {
    if (this.loadFn) await this.loadFn(key);
    return this.findFnAsync(key);
  }

  // private
  async mustFind(key) {
    const value = await this.value(key);

    if (_.isUndefined(value)) throw new Error(`${this.storeTitle} "${key}" is not found.`);
    return value;
  }
}

module.exports = KeyGetterDelegate;
