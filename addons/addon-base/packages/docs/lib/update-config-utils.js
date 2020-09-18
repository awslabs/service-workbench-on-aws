const _ = require('lodash');

/**
 * Docusaurus Sidebar objects (https://v2.docusaurus.io/docs/next/docs-introduction/#sidebar)
 * are nested structures consisting of alternnating objects and arrays.
 *
 * This method allows one to in-place mutate a path on a sidebar object, with Lodash _.set
 * style syntax (https://lodash.com/docs/4.17.15#set).
 *
 * @param {object} object The object to modify
 * @param {string} path The path of the property to set
 * @param {string|object} value The value to set
 *
 * @returns {object} Updated `object`. Note this method mutates `object`.
 */
function setSidebarsEntry(object, path, value) {
  if (!_.isPlainObject(object)) {
    throw new Error('Expected object to be a plain object');
  }
  if (!_.isString(path)) {
    throw new Error('Expected path to be a string');
  }

  const pathArray = path.split('.');
  // Pointer within the object
  let pointer = object;

  pathArray.forEach((pathElement) => {
    if (_.isPlainObject(pointer)) {
      const foundElement = pointer[pathElement];
      if (foundElement) {
        // Element already exists, so update pointer and move on
        pointer = pointer[pathElement];
        return;
      }
      // Element does not yet exist, so create
      pointer[pathElement] = [];
      pointer = pointer[pathElement];
      return;
    }

    if (_.isArray(pointer)) {
      const foundElementIdx = pointer.findIndex((el) => _.isObject(el) && el[pathElement]);
      if (foundElementIdx !== -1) {
        // Element already exists, so update pointer and move on
        pointer = pointer[foundElementIdx][pathElement];
        return;
      }
      // Element does not yet exist, so create
      const count = pointer.push({ [pathElement]: [] });
      pointer = pointer[count - 1][pathElement];
      return;
    }

    throw new Error(
      `Expected to find only arrays or plain objects when traversing a Sidebar object, but found ${pointer}`,
    );
  });

  if (!_.isArray(pointer)) {
    throw new Error('Expected pointer to be an array');
  }
  pointer.push(value);
  return object;
}

/**
 * Docusaurus Sidebar objects (https://v2.docusaurus.io/docs/next/docs-introduction/#sidebar)
 * are nested structures consisting of alternnating objects and arrays.
 *
 * This method allows one to merge two sidebars objects with Lodash _.merge
 * style syntax (https://lodash.com/docs/4.17.15#merge).
 *
 * @param {object} sidebarsA The first sidebars object to merge
 * @param {object} sidebarsB The second sidebars object to merge
 *
 * @returns {object} Updated `sidebarsA`, with contents merged with `sidebarsB`. Note this
 * method mutates `sidebarsA`.
 */
// eslint-disable-next-line
function mergeSidebarsEntries(sidebarsA, sidebarsB) {
  // TODO: Not yet implemented. This function would be more convenient than `setSidebarsEntry` for
  // contributing plugins that have many lines of sidebars config to contribute.
}

module.exports = { setSidebarsEntry };
