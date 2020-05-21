const _ = require('lodash');
const inspect = require('util').inspect;

// a promise friendly delay function
function delay(seconds) {
  return new Promise(resolve => {
    _.delay(resolve, seconds * 1000);
  });
}

function formatObject(obj) {
  return inspect(obj, { showHidden: false, depth: 7 });
}

module.exports = {
  delay,
  formatObject,
};
