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
const Service = require('@aws-ee/base-services-container/lib/service');

const { runAndCatch, sleep } = require('../helpers/utils');
const obtainWriteLockSchema = require('../schema/obtain-write-lock.json');
const releaseWriteLockSchema = require('../schema/release-write-lock.json');

const settingKeys = {
  tableName: 'dbLocks',
};

class LockService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'dbService']);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
  }

  /**
   * Exclusively obtains a write lock and returns a write token if the lock is available or returns undefined if the lock is not available.
   *
   * @param {{id: string, expiresIn: number}} lockInfo Lock info with 'id' of the lock and 'expiresIn' (in seconds).
   * The 'id' can be any identifier to uniquely identify the lock within the system. At anytime, only one write lock with the same 'id' can be obtained.
   * The 'expiresIn' indicates the lock expiry time in seconds AFTER the lock is successfully obtained. Any further calls to 'obtainWriteLock'
   * will return undefined until either of the following conditions are met
   * 1. Lock is released: The given lock is explicitly released using the "releaseWriteLock" method OR
   * 2. Lock is expired: The 'expiresIn' number of seconds have passed since the lock was obtained.
   *
   * @returns write token or undefined if lock could not be obtained
   */
  async obtainWriteLock(lockInfo) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(lockInfo, obtainWriteLockSchema);
    const { id, expiresIn } = lockInfo;
    const nowInSeconds = Math.ceil(Date.now() / 1000);
    const ttlInSeconds = nowInSeconds + expiresIn;

    try {
      await this._updater()
        // .mark(['readLocks'])
        // .condition('attribute_not_exists(writeLock) AND (attribute_not_exists(readLocks) OR attribute_type(readLocks, :isNull ))') // later when we implement read locks
        .condition('attribute_not_exists(id) OR #ttl < :now ') // yes we need this
        .key('id', id)
        .names({ '#ttl': 'ttl' })
        .values({ ':now': nowInSeconds })
        .item({
          ttl: ttlInSeconds,
        })
        .update();

      return id;
    } catch (err) {
      // Yes, in most cases, catching an exception to simply ignore it, is not a good practice. But, this is by design.
      return undefined;
    }
  }

  /**
   * Releases the write lock given the write token. The token is returned when you call "obtainWriteLock" or "tryWriteLock".
   * The token should be passed here to release the corresponding lock.
   *
   * @param {{writeToken: string}} lockReleaseInfo An object containing "writeToken".
   * @returns {Promise<void>}
   */
  async releaseWriteLock(lockReleaseInfo) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(lockReleaseInfo, releaseWriteLockSchema);
    const { writeToken } = lockReleaseInfo;

    await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)')
          .key('id', writeToken)
          .delete();
      },
      async () => {
        // we ignore the ConditionalCheckFailedException exception because it simply means that the entry might
        // have already been removed
      },
    );
  }

  /**
   * Attempts to obtain a lock given the number of attempts, with one second wait after each attempt (no backoff algorithm)
   *
   * @param {{id: string, expiresIn: number}} lockInfo Lock info with 'id' of the lock and 'expiresIn' (in seconds)
   * @param {{attemptsCount:number}} Attempts info with attemptsCount indicating maximum number of attempts to obtain the lock with one second wait after each attempt.
   * @returns {Promise<*>} write token or undefined if lock could not be obtained within the specified number of attempts
   */
  async tryWriteLock(lockInfo, { attemptsCount = 4 } = {}) {
    let result;
    for (let i = 0; i < attemptsCount; i += 1) {
      try {
        // We need to await in sequence so disabling "no-await-in-loop" rule here
        // eslint-disable-next-line no-await-in-loop
        result = await this.obtainWriteLock(lockInfo);
        if (!result) throw this.boom.internalError('Could not obtain lock', true);
        break;
      } catch (error) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(1000);
        // ignore
      }
    }
    return result;
  }

  /**
   * Attempts to obtain a lock given the number of attempts, with one second wait after each attempt (no backoff algorithm)
   * and runs the specified function while holding the lock. Releases the lock after successful or failed (when the function throws any Error)
   * function excution.
   *
   * @param {{id: string, expiresIn: number}} lockInfo Lock info with 'id' of the lock and 'expiresIn'.
   * @param {function} fn The function to be executed while holding the obtained lock
   * @param {{attemptsCount: number}} options options obj with max 'attemptsCount'
   * @returns lock object or undefined if lock could not be obtained after the specified number of attempts
   */
  async tryWriteLockAndRun({ id, expiresIn = 25 } = {}, fn, { attemptsCount = 15 } = {}) {
    // we attempt to obtain a lock (max 15 times with 1 second delay in between)
    const lock = await this.tryWriteLock({ id, expiresIn }, { attemptsCount });
    if (_.isUndefined(lock)) throw this.boom.internalError('Could not obtain a lock', true);

    try {
      return await fn();
    } finally {
      try {
        await this.releaseWriteLock({ writeToken: lock });
      } catch (error2) {
        this.log.info(`The release lock has an issue ${error2}`);
        // ignore this error
      }
    }
  }

  // TODO
  // - read locks APIs
  // - extendWriteLock (to extend the expire of a lock)
  // - obtainReadLock
  // - extendReadLock
  // - releaseReadLock
  // - vacuumExpiredLocks
}

module.exports = LockService;
