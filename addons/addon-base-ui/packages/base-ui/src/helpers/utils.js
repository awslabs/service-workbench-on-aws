/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import _ from 'lodash';
import numeral from 'numeral';
import { observable } from 'mobx';

/**
 * Converts the given Map object to an array of values from the map
 */
function mapToArray(map) {
  const result = [];
  // converting map to result array
  map.forEach((value) => result.push(value));
  return result;
}

function parseError(err) {
  const message = _.get(err, 'message', 'Something went wrong');
  const code = _.get(err, 'code');
  const status = _.get(err, 'status');
  const requestId = _.get(err, 'requestId');
  const error = new Error(message);

  error.code = code;
  error.requestId = requestId;
  error.root = err;
  error.status = status;

  return error;
}

function swallowError(promise, fn = () => ({})) {
  try {
    return Promise.resolve()
      .then(() => promise)
      .catch((err) => fn(err));
  } catch (err) {
    return fn(err);
  }
}

const storage = observable({
  clear() {
    try {
      if (localStorage) return localStorage.clear();
      return window.localStorage.clear();
    } catch (err) {
      console.log(err);
      try {
        if (sessionStorage) return sessionStorage.clear();
        return window.sessionStorage.clear();
      } catch (error) {
        // if we get here, it means no support for localStorage nor sessionStorage, which is a problem
        return console.log(error);
      }
    }
  },

  getItem(key) {
    try {
      if (localStorage) return localStorage.getItem(key);
      return window.localStorage.getItem(key);
    } catch (err) {
      console.log(err);
      try {
        if (sessionStorage) return sessionStorage.getItem(key);
        return window.sessionStorage.getItem(key);
      } catch (error) {
        // if we get here, it means no support for localStorage nor sessionStorage, which is a problem
        return console.log(error);
      }
    }
  },

  setItem(key, value) {
    try {
      if (localStorage) return localStorage.setItem(key, value);
      return window.localStorage.setItem(key, value);
    } catch (err) {
      console.log(err);
      try {
        if (sessionStorage) return sessionStorage.setItem(key, value);
        return window.sessionStorage.setItem(key, value);
      } catch (error) {
        // if we get here, it means no support for localStorage nor sessionStorage, which is a problem
        return console.log(error);
      }
    }
  },

  removeItem(key) {
    try {
      if (localStorage) return localStorage.removeItem(key);
      return window.localStorage.removeItem(key);
    } catch (err) {
      console.log(err);
      try {
        if (sessionStorage) return sessionStorage.removeItem(key);
        return window.sessionStorage.removeItem(key);
      } catch (error) {
        // if we get here, it means no support for localStorage nor sessionStorage, which is a problem
        return console.log(error);
      }
    }
  },
});

// a promise friendly delay function
function delay(seconds) {
  return new Promise((resolve) => {
    _.delay(resolve, seconds * 1000);
  });
}

function niceNumber(value) {
  if (_.isNil(value)) return 'N/A';
  if (_.isString(value) && _.isEmpty(value)) return 'N/A';
  return numeral(value).format('0,0');
}

function nicePrice(value) {
  if (_.isNil(value)) return 'N/A';
  if (_.isString(value) && _.isEmpty(value)) return 'N/A';
  return numeral(value).format('0,0.00');
}

// super basic plural logic, laughable
function plural(singleStr, pluralStr, count) {
  if (count === 1) return singleStr;
  return pluralStr;
}

function getQueryParam(location, key) {
  const queryParams = new URL(location).searchParams;
  return queryParams.get(key);
}

function addQueryParams(location, params) {
  const url = new URL(location);
  const queryParams = url.searchParams;

  const keys = _.keys(params);
  keys.forEach((key) => {
    queryParams.append(key, params[key]);
  });

  let newUrl = url.origin + url.pathname;

  if (queryParams.toString()) {
    newUrl += `?${queryParams.toString()}`;
  }

  newUrl += url.hash;
  return newUrl;
}

function removeQueryParams(location, keys) {
  const url = new URL(location);
  const queryParams = url.searchParams;

  keys.forEach((key) => {
    queryParams.delete(key);
  });

  let newUrl = url.origin + url.pathname;

  if (queryParams.toString()) {
    newUrl += `?${queryParams.toString()}`;
  }

  newUrl += url.hash;
  return newUrl;
}

function getFragmentParam(location, key) {
  const fragmentParams = new URL(location).hash;
  const hashKeyValues = {};
  const params = fragmentParams.substring(1).split('&');
  if (params) {
    params.forEach((param) => {
      const keyValueArr = param.split('=');
      const currentKey = keyValueArr[0];
      const value = keyValueArr[1];
      if (value) {
        hashKeyValues[currentKey] = value;
      }
    });
  }
  return hashKeyValues[key];
}

function removeFragmentParams(location, keyNamesToRemove) {
  const url = new URL(location);
  const fragmentParams = url.hash;
  let hashStr = '#';
  const params = fragmentParams.substring(1).split('&');
  if (params) {
    params.forEach((param) => {
      const keyValueArr = param.split('=');
      const currentKey = keyValueArr[0];
      const value = keyValueArr[1];
      // Do not include the currentKey if it is the one specified in the array of keyNamesToRemove
      if (value && _.indexOf(keyNamesToRemove, currentKey) < 0) {
        hashStr = `${currentKey}${currentKey}=${value}`;
      }
    });
  }
  return `${url.protocol}//${url.host}${url.search}${hashStr === '#' ? '' : hashStr}`;
}

function isAbsoluteUrl(url) {
  // return /^[a-z][a-z\d+.-]*:/.test(url);
  return /^https?:/.test(url);
}

function removeNulls(obj = {}) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null) delete obj[key];
  });

  return obj;
}

// remove the "end" string from "str" if it exists
function chopRight(str = '', end = '') {
  if (!_.endsWith(str, end)) return str;
  return str.substring(0, str.length - end.length);
}

const isFloat = (n) => {
  return n % 1 !== 0;
};

// input [ { <name>: { label, desc, ..} }, { <name2>: { label, desc } } ]
// output { <name>: { label, desc, ..}, <name2>: { label, desc } }
function childrenArrayToMap(arr) {
  const result = {};
  arr.forEach((item) => {
    const key = _.keys(item)[0];
    result[key] = item[key];
  });
  return result;
}

let idGeneratorCount = 0;

function generateId(prefix = '') {
  idGeneratorCount += 1;
  return `${prefix}_${idGeneratorCount}_${Date.now()}_${_.random(0, 1000)}`;
}

// Given a Map and an array of items (each item MUST have an "id" prop), consolidate
// the array in the following manner:
// - if an existing item in the map is no longer in the array of items, remove the item from the map
// - if an item in the array is not in the map, then add it to the map using the its "id" prop
// - if an item in the array is also in the map, then call 'mergeExistingFn' with the existing item
//   and the new item. It is expected that this 'mergeExistingFn', will know how to merge the
//   properties of the new item into the existing item.
function consolidateToMap(map, itemsArray, mergeExistingFn) {
  const unprocessedKeys = {};

  map.forEach((_value, key) => {
    unprocessedKeys[key] = true;
  });

  itemsArray.forEach((item) => {
    const id = item.id;
    const hasExisting = map.has(id);
    const exiting = map.get(id);

    if (!exiting) {
      map.set(item.id, item);
    } else {
      mergeExistingFn(exiting, item);
    }

    if (hasExisting) {
      delete unprocessedKeys[id];
    }
  });

  _.forEach(unprocessedKeys, (_value, key) => {
    map.delete(key);
  });
}

/**
 * Converts an object graph into flat object with key/value pairs.
 * The rules of object graph to flat key value transformation are as follows.
 * 1. An already flat attribute with primitive will not be transformed.
 *    For example,
 *      input = { someKey: 'someValue' } => output = { someKey: 'someValue' }
 * 2. A nested object attribute will be flattened by adding full attribute path '<attributeName>.' (the paths are as per lodash's get and set functions)
 *    For example,
 *      input = { someKey: { someNestedKey: 'someValue' } } => output = { 'someKey.someNestedKey': 'someValue' }
 * 3. An array attribute will be flattened by adding correct path '<attributeName>[<elementIndex>]' prefix. (the paths are as per lodash's get and set functions)
 *    For example,
 *      input = { someKey: [ 'someValue1', 'someValue2' ] } => output = { 'someKey[0]': 'someValue1', 'someKey[1]': 'someValue2' }
 *      input = { someKey: [ 'someValue1', ['someValue2','someValue3'], 'someValue4' ] } => output = { 'someKey[0]': 'someValue1', 'someKey[1][0]': 'someValue2', 'someKey[1][1]': 'someValue3', 'someKey[2]': 'someValue4' }
 *      input = { someKey: [{ someNestedKey: 'someValue' }] } => output = { 'someKey[0].someNestedKey': 'someValue' }
 *
 * @param obj An object to flatten
 * @param filterFn An optional filter function that allows filtering out certain attributes from being included in the flattened result object. The filterFn is called with 3 arguments (result, value, key) and is expected to return true to include
 *   the key in the result or false to exclude the key from the result.
 * @param keyPrefix A optional key prefix to include in all keys in the resultant flattened object.
 * @param accum An optional accumulator to use when performing the transformation
 * @returns {*}
 */
function flattenObject(obj, filterFn = () => true, keyPrefix = '', accum = {}) {
  function toFlattenedKey(key, idx) {
    let flattenedKey;
    if (_.isNil(idx)) {
      if (_.isNumber(key)) {
        flattenedKey = keyPrefix ? `${keyPrefix}[${key}]` : `[${key}]`;
      } else {
        flattenedKey = keyPrefix ? `${keyPrefix}.${key}` : key;
      }
    } else {
      flattenedKey = keyPrefix ? `${keyPrefix}.${key}[${idx}]` : `${key}[${idx}]`;
    }
    return flattenedKey;
  }

  return _.transform(
    obj,
    (result, value, key) => {
      if (filterFn(result, value, key)) {
        if (_.isArray(value)) {
          let idx = 0;
          _.forEach(value, (element) => {
            const flattenedKey = toFlattenedKey(key, idx);
            if (_.isObject(element)) {
              flattenObject(element, filterFn, flattenedKey, result);
            } else {
              result[flattenedKey] = element;
            }
            ++idx;
          });
        } else {
          const flattenedKey = toFlattenedKey(key);
          if (_.isObject(value)) {
            flattenObject(value, filterFn, flattenedKey, result);
          } else {
            result[flattenedKey] = value;
          }
        }
      }
      return result;
    },
    accum,
  );
}

/**
 * Converts an object with key/value pairs into object graph. This function is inverse of flattenObject.
 * i.e., unFlattenObject(flattenObject(obj)) = obj
 *
 * The rules of key/value pairs to object graph transformation are as follows.
 * 1. Key that does not contain delimiter will not be transformed.
 *    For example,
 *      input = { someKey: 'someValue' } => output = { someKey: 'someValue' }
 * 2. Key/Value containing delimiter will be transformed into object path
 *    For example,
 *      input = { someKey_someNestedKey: 'someValue' } => output = { someKey: { someNestedKey: 'someValue' } }
 * 3. Key/Value containing delimiter and integer index will be transformed into object containing array.
 *    For example,
 *      input = { someKey_0: 'someValue1', someKey_1: 'someValue2' } => output = { someKey: [ 'someValue1', 'someValue2' ] }
 *      input = { "someKey_0": "someValue1", "someKey_1_0": "someValue2", "someKey_1_1": "someValue3", "someKey_2": "someValue4" } => output = { someKey: [ 'someValue1', ['someValue2','someValue3'], 'someValue4' ] }
 *      input = { someKey_0_someNestedKey: 'someValue' } => output = { someKey: [{ someNestedKey: 'someValue' }] }
 *
 * @param obj An object to flatten
 * @param filterFn An optional filter function that allows filtering out certain attributes from being included in the flattened result object. The filterFn is called with 3 arguments (result, value, key) and is expected to return true to include
 *   the key in the result or false to exclude the key from the result.
 * @param keyPrefix A optional key prefix to include in all keys in the resultant flattened object.
 * @returns {*}
 */
function unFlattenObject(keyValuePairs, filterFn = () => true) {
  return _.transform(
    keyValuePairs,
    (result, value, key) => {
      if (filterFn(result, value, key)) {
        _.set(result, key, value);
      }
      return result;
    },
    {},
  );
}

function toUTCDate(str) {
  if (_.isEmpty(str)) return str;
  if (!_.isString(str)) return str;
  if (_.endsWith(str, 'Z')) return str;

  return `${str}Z`;
}

/**
 * Given a list of validatorjs rules for a form element, returns valid options
 * by returning elements defined by the "in" rule as valid Semantic UI options objects.
 *
 * @param {Array} formRules Rules for the validatorjs library
 * @returns {Array<Object>} Options formatted for a Semantic UI Dropdown
 */
function getOptionsFromRules(formRules) {
  let options = [];
  formRules.forEach((rule) => {
    if (typeof rule === 'object' && 'in' in rule) {
      options = rule.in.map((option) => ({ key: option, text: option, value: option }));
    }
  });
  return options;
}

function validRegions() {
  return [
    'us-east-2',
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'ap-east-1',
    'ap-south-1',
    'ap-northeast-3',
    'ap-northeast-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ca-central-1',
    'cn-north-1',
    'cn-northwest-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-north-1',
    'me-south-1',
    'sa-east-1',
    'us-gov-east-1',
    'us-gov-west-1',
  ].sort();
}

/**
 * Converts bytes to a human-friendly string by representing them as KB, MB, GB,
 * etc., depending on how large the size is.
 * Adapted from https://stackoverflow.com/a/18650828
 *
 * @param {number} bytes The number of bytes to be converted
 * @param {number} decimals How many decimal places should be maintained
 * @returns {string} The human-friendly string form of the passed bytes
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * A utility function to process given items in sequence of batches. Items in one batch are processed in-parallel but
 * all batches are processed sequentially i..e, processing of the next batch is not started until the previous batch is
 * complete.
 *
 * @param items Array of items to process
 * @param batchSize Number of items in a batch
 * @param processorFn A function to process the batch. The function is called with the item argument.
 * The function is expected to return a Promise with some result of processing the item.
 *
 * @returns {Promise<Array>}
 */
async function processInBatches(items, batchSize, processorFn) {
  const itemBatches = _.chunk(items, batchSize);

  let results = [];

  // Process all items in one batch in parallel and wait for the batch to
  // complete before moving on to the next batch
  for (let i = 0; i <= itemBatches.length; i += 1) {
    const itemsInThisBatch = itemBatches[i];
    // We need to await for each batch in loop to make sure they are awaited in sequence instead of
    // firing them in parallel disabling eslint for "no-await-in-loop" due to this
    // eslint-disable-next-line no-await-in-loop
    const resultsFromThisBatch = await Promise.all(
      //  Fire promise for each item in this batch and let it be processed in parallel
      _.map(itemsInThisBatch, processorFn),
    );

    // push all results from this batch into the main results array
    results = _.concat(results, resultsFromThisBatch);
  }
  return results;
}

/**
 * A utility function that processes items sequentially. The function uses the specified processorFn to process
 * items in the given order i.e., it does not process next item in the given array until the promise returned for
 * the processing of the previous item is resolved. If the processorFn throws error (or returns a promise rejection)
 * this functions stops processing next item and the error is bubbled up to the caller (via a promise rejection).
 *
 * @param items Array of items to process
 * @param processorFn A function to process the item. The function is called with the item argument.
 * The function is expected to return a Promise with some result of processing the item.
 *
 * @returns {Promise<Array>}
 */
async function processSequentially(items, processorFn) {
  return processInBatches(items, 1, processorFn);
}

export {
  mapToArray,
  parseError,
  swallowError,
  storage,
  delay,
  niceNumber,
  plural,
  getQueryParam,
  removeQueryParams,
  addQueryParams,
  getFragmentParam,
  removeFragmentParams,
  nicePrice,
  isFloat,
  removeNulls,
  chopRight,
  childrenArrayToMap,
  isAbsoluteUrl,
  generateId,
  consolidateToMap,
  flattenObject,
  unFlattenObject,
  toUTCDate,
  getOptionsFromRules,
  validRegions,
  formatBytes,
  processInBatches,
  processSequentially,
};
