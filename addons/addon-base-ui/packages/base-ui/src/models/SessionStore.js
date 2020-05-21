/* eslint-disable max-classes-per-file */
import _ from 'lodash';

class EventBus {
  constructor() {
    this.listenersMap = {};
  }

  listenTo(channel, { id, listener }) {
    const entries = this.listenersMap[channel] || [];
    entries.push({ id, listener });

    this.listenersMap[channel] = entries;
  }

  async fireEvent(channel, event) {
    const keys = _.keys(this.listenersMap);

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const key of keys) {
      if (_.startsWith(key, channel)) {
        const entries = this.listenersMap[key];
        for (const entry of entries) {
          await entry.listener(event, { entry, channel });
        }
      }
    }
  }
  /* eslint-enable no-restricted-syntax, no-await-in-loop */
  // TODO stopListening(id, channel) { }
}

const uiEventBus = new EventBus();

// A simple key/value store that only exists while the browser tab is open.
// You can choose to store your component ui states in here when applicable.
class SessionStore {
  constructor() {
    this.map = new Map();
  }

  cleanup() {
    this.map.clear();
  }

  // remove all keys that start with the prefix
  removeStartsWith(prefix) {
    // map api https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    // for of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
    const keys = this.map.keys();
    /* eslint-disable no-restricted-syntax */
    for (const key of keys) {
      if (_.startsWith(key, prefix)) {
        this.map.delete(key);
      }
    }
    /* eslint-enable no-restricted-syntax */
  }

  get(key) {
    return this.map.get(key);
  }

  set(key, value) {
    this.map.set(key, value);
  }
}

const sessionStore = new SessionStore();

function registerContextItems(appContext) {
  appContext.sessionStore = sessionStore;
  appContext.uiEventBus = uiEventBus;
}

export { sessionStore, uiEventBus, registerContextItems };
