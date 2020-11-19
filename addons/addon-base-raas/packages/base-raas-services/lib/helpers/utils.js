const path = require('path');
const _ = require('lodash');
const nanoid = require('nanoid');

function generateId() {
  // Note: we don't use the default alphabet that comes with nanoid because it contains '_'
  // which is not an allowed character for cloudformation stack names and role names
  const generator = nanoid.customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 22);
  return generator();
}

// remove the "end" string from "str" if it exists
function chopRight(str = '', end = '') {
  if (!_.endsWith(str, end)) return str;
  return str.substring(0, str.length - end.length);
}

// remove the "start" string from "str" if it exists
function chopLeft(str = '', start = '') {
  if (!_.startsWith(str, start)) return str;
  return str.substring(start.length);
}

function normalizeStudyFolder(str = '') {
  // First we want to make sure that all '../' are resolved now.
  // Note: path.resolve, will also remove any trailing forward slashes
  const resolved = path.resolve('/', str);

  return _.endsWith(resolved, '/') ? resolved : `${resolved}/`;
}

module.exports = {
  generateId,
  chopRight,
  chopLeft,
  normalizeStudyFolder,
};
