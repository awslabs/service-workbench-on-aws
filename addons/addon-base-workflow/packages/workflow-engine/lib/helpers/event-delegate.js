const _ = require('lodash');

class EventDelegate {
  constructor({ supportedEvents = [], sponsorName = '' } = {}) {
    this.supportedEvents = supportedEvents;
    this.sponsorName = sponsorName;
    this.listenersMap = {}; // key is the event name, value is a list of all listeners
  }

  on(name, fn) {
    const events = this.supportedEvents;
    if (_.indexOf(events, name) === -1) throw new Error(`Event "${name}" is not supported by ${this.sponsorName}.`);
    const entries = this.listenersMap[name] || [];
    entries.push(fn);
    this.listenersMap[name] = entries;

    return this;
  }

  async fireEvent(name, ...params) {
    const listeners = this.listenersMap[name];
    if (_.isEmpty(listeners)) return;
    /* eslint-disable no-restricted-syntax */
    for (const listener of listeners) {
      await listener(...params); // eslint-disable-line no-await-in-loop
    }
    /* eslint-enable no-restricted-syntax */
  }
}

module.exports = EventDelegate;
