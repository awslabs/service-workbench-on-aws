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

const _ = require('lodash');

function toVersionString(num) {
  return `v${_.padStart(num, 4, '0')}_`;
}

function parseVersionString(str) {
  return parseInt(str.substring(1), 10);
}

// Convenient function to wrap the db call with a catch for the ConditionalCheckFailedException
async function runAndCatch(fn, handler, code = 'ConditionalCheckFailedException') {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    if (error && error.code === code) {
      return handler(error);
    }

    throw error;
  }
}

/**
 * A utility interval function for exponential back-off strategy. (i.e., intervals of 1, 2, 4, 8, 16 .. seconds)
 *
 * @param {Number} attemptCount
 * @param {Number} baseInterval
 * @return {Number}
 */
function exponentialInterval(attemptCount, baseInterval = 500) {
  return baseInterval * 2 ** attemptCount;
}

/**
 * A utility interval function for liner back-off strategy. (i.e., intervals of 1, 2, 3, 4, 5 .. seconds)
 *
 * @param {Number} attemptCount
 * @param {Number} baseInterval
 * @return {Number}
 */
function linearInterval(attemptCount, baseInterval = 1000) {
  return baseInterval * attemptCount;
}

/**
 * Retries calling a function as many times as requested by the 'times' argument. The retries are done with
 * back-offs specified by the 'intervalFn'. By default, it uses {@link exponentialInterval} function to pause
 * between each retry with exponential back-off (i.e., intervals of 1, 2, 4, 8, 16 .. seconds)
 *
 * @param {Function} fn - the fn to retry if it is rejected ( "fn" must return a promise )
 *
 * @param {Number} maxAttempts - maximum number of attempts calling the function. This includes first attempt and all
 * retries.
 * @param {Function} intervalFn - The interval function to decide the pause between the attempts. The function is
 * invoked with one argument 'attempt' number. The 'attempt' here is the count of calls attempted so far. For
 * example, if the 'fn' fails during the first attempt then the 'intervalFn' is called with attempt = 1. The
 * intervalFn is expected to return the pause time in milliseconds to wait before making the next 'fn' call attempt.
 *
 * @returns {Promise<*>} The promise returned by the 'fn'. The returned promise will be rejected with the error thrown
 * by 'fn' if the 'fn' still fails after the specified number of attempts.
 */
async function retry(fn, maxAttempts = 3, intervalFn = exponentialInterval) {
  let caughtError;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      // We need to await before making next attempt so disabling no-await-in-loop lint rule here
      // eslint-disable-next-line no-await-in-loop
      const result = await fn();
      return result;
    } catch (err) {
      caughtError = err;
      // eslint-disable-next-line no-await-in-loop
      await sleep(intervalFn(i + 1));
    }
  }
  // We reached here means we exhausted all attempts calling the "fn"
  // Propagate error that was caught in the last unsuccessful attempt
  throw caughtError;
}

/**
 * A utility function to process given items in sequence of batches. Items in one batch are processed in-parallel but
 * all batches are processed sequentially i..e, processing of the next batch is not started until the previous batch is
 * complete.
 *
 * @param items Array of items to process
 * @param batchSize Number of items in a batch
 * @param processorFn A function to process the batch. The function is called with the item argument.
 * The function is expected to return a Promise with some result of processing the item. If the "processorFn" throws an
 * error for any item, the "processInBatches" function will fail immediately. Processing of other items in that batch
 * may be already in-flight at that point. Due to this, if you need to handle partial batch failures or if you need
 * fine grained error handling control at individual item level, you should handle errors in the "processorFn" itself
 * (using try/catch or Promise.catch etc) and make sure that the "processorFn" does not throw any errors.
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

/**
 * Returns a promise that will be resolved in the requested time, ms.
 * Example: await sleep(200);
 * https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep/39914235#39914235
 *
 * @param ms wait time in milliseconds
 *
 * @returns a promise, that will be resolved in the requested time
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  toVersionString,
  parseVersionString,
  runAndCatch,
  exponentialInterval,
  linearInterval,
  retry,
  processInBatches,
  processSequentially,
  sleep,
};
