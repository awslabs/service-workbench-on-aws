const _ = require('lodash');

// The memento shape is:
// {
//   "m": string      // "m" = method name
//   "p": json string // "p" = parameters in json
// }
class Invoker {
  constructor(methodName, ...params) {
    this.methodName = methodName;
    const result = [];
    _.forEach([...params], item => {
      if (item instanceof Error) {
        const obj = {};
        _.forEach(Object.keys(item), key => {
          obj[key] = item[key];
        });
        Object.getOwnPropertyNames(item).forEach(key => {
          obj[key] = item[key];
        });

        result.push(obj);
      } else result.push(item);
    });
    this.params = JSON.stringify(result);
  }

  setMemento({ m, p = '[]' }) {
    this.methodName = m;
    this.params = p;

    return this;
  }

  getMemento() {
    return {
      m: this.methodName,
      p: this.params,
    };
  }

  async invoke(stepImplementation, ...rightParams) {
    if (!this.methodName) return undefined;
    const leftParams = JSON.parse(this.params);
    const fn = stepImplementation[this.methodName];
    if (!_.isFunction(fn)) throw new Error(`Was trying to call ${this.methodName}(), but this method is not defined.`);
    return fn.call(stepImplementation, ...leftParams, ...rightParams);
  }
}

module.exports = Invoker;
