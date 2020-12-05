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

/**
 * A normalized study folder (a.k.a prefix) should have no leading forward slash but should have a trailing
 * forward slash. If the study is the whole bucket, then the a normalized study folder should be '/'.
 */
function normalizeStudyFolder(str = '') {
  // First we want to make sure that all '../' are resolved now.
  // Note: path.resolve, will also remove any trailing forward slashes
  let resolved = path.resolve('/', str);

  // If the whole path is just '/' then return it as is. This is the case when the whole bucket might be the study
  if (resolved === '/') return '/';

  // Remove the leading forward slash if present
  resolved = chopLeft(resolved, '/');
  // Add a trailing forward slash if missing
  return _.endsWith(resolved, '/') ? resolved : `${resolved}/`;
}

module.exports = {
  generateId,
  chopRight,
  chopLeft,
  normalizeStudyFolder,
};
