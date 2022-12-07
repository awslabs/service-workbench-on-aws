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
const uuid = require('uuid/v4');
const { generateKeyPair } = require('crypto');
const forge = require('node-forge');

const Service = require('@amzn/base-services-container/lib/service');
const {
  isAllow,
  allowIfActive,
  allowIfCurrentUserOrAdmin,
} = require('@amzn/base-services/lib/authorization/authorization-utils');
const { runAndCatch } = require('@amzn/base-services/lib/helpers/utils');
const createKeyPairSchema = require('./schema/create-key-pair');
const updateKeyPairSchema = require('./schema/update-key-pair');

const settingKeys = {
  tableName: 'dbKeyPairs',
};

class KeyPairService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'dbService', 'authorizationService', 'auditWriterService']);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);
  }

  // LIMITATION: DOES NOT SUPPORT MORE THAN 2000 KEY-PAIRS PER USER
  async list(requestContext, { fields = [], filter = {} } = {}) {
    // If no principal (user) based filter is specified then return only key-pairs associated to the caller
    const filterPrincipalIdentifier = _.get(
      filter,
      'principal.principalIdentifier',
      requestContext.principalIdentifier, // hash shape { uid }
    );

    if (_.isEmpty(filterPrincipalIdentifier.uid)) {
      throw this.boom.badRequest(`Invalid principal filter specified. The principal filter must contain 'uid'`, true);
    }

    // ensure that the caller has permissions to list key-pairs
    // Perform default condition checks to make sure the caller is active and is trying to list only key-pairs associated to him/her
    // or is an active admin
    await this.assertAuthorized(
      requestContext,
      {
        action: 'list',
        conditions: [allowIfActive, allowIfCurrentUserOrAdmin], // Implicit AND
      },
      filterPrincipalIdentifier,
    );

    const uid = filterPrincipalIdentifier.uid;
    const result = await this._query()
      .index('ByUID')
      .key('uid', uid) // return key-pairs associated with the specified principal
      .limit(2000)
      .projection(fields)
      .query();

    const dataObjects = _.map(result || [], k => this._fromDbToDataObject(k));
    return dataObjects;
  }

  async find(requestContext, { id, fields = [] }) {
    // Make sure 'uid' is always returned as that's required for authorizing the 'get' action
    // If empty "fields" is specified then it means the caller is asking for all fields. No need to append 'uid'
    // in that case.
    const fieldsToGet = _.isEmpty(fields) ? fields : _.uniq([...fields, 'uid']);
    const keyPair = await this._getter()
      .key({ id })
      .projection(fieldsToGet)
      .get();
    const keyPairObj = this._fromDbToDataObject(keyPair);

    if (keyPairObj) {
      // Make sure the user has permissions to read the key-pair
      // By default, allow "read" only to active admin users or self
      const isAuthorized = await this.isAuthorized(
        requestContext,
        {
          action: 'read',
          conditions: [allowIfActive, allowIfCurrentUserOrAdmin],
        },

        // pass key-pair along with uid.
        // The {uid} is required by the authorization logic in "allowIfCurrentUserOrAdmin"
        // keyPairObj.principalIdentifier has shape { uid }
        { ...keyPairObj, ...keyPairObj.principalIdentifier },
      );

      if (!isAuthorized) {
        // Throw 404 - NotFound instead of 401 - Forbidden if the user is trying to read some key he/she does not have access to
        // This is to not give any indication about the key if user is trying to read a one they don't have permissions for
        throw this.boom.notFound(`key-pair with id "${id}" does not exist`, true);
      }
    }

    // Write audit event
    await this.audit(requestContext, { action: 'read-key-pair', body: { id } });

    return keyPairObj;
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`key-pair with id "${id}" does not exist`, true);
    return result;
  }

  async create(requestContext, keyPair) {
    const createKeyPairFor = keyPair && keyPair.uid ? { uid: keyPair.uid } : requestContext.principalIdentifier;

    const id = uuid();

    // Make sure the user has permissions to create the key-pair
    // By default, allow only active admin users or self
    await this.assertAuthorized(
      requestContext,
      { action: 'create', conditions: [allowIfActive, allowIfCurrentUserOrAdmin] },
      { ...keyPair, ...createKeyPairFor },
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(keyPair, createKeyPairSchema);

    const by = _.get(requestContext, 'principalIdentifier.uid');

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(keyPair, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
      uid: createKeyPairFor.uid,
    });

    let privateKey = '';
    if (dbObject.publicKey) {
      // TODO: Make sure publicKey is valid ssh key in PEM format
    } else {
      const keyPairMaterial = await this.generateSshKeyPairMaterial();
      dbObject.publicKey = keyPairMaterial.publicKey;
      privateKey = keyPairMaterial.privateKey; // DO NOT store or log privateKey anywhere
    }
    dbObject.status = dbObject.status || 'active';

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // make sure we fail if record with same id already exists
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`key-pair with id "${id}" already exists`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'create-key-pair', body: { id } });

    return this._fromDbToDataObject({ ...result, privateKey });
  }

  async update(requestContext, keyPair) {
    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(keyPair, updateKeyPairSchema);

    const existingKeyPair = await this.mustFind(requestContext, {
      id: keyPair.id,
    });

    // Make sure the user has permissions to update the key-pair
    // By default, allow only active admin users or self
    await this.assertAuthorized(
      requestContext,
      {
        action: 'update',
        conditions: [allowIfActive, allowIfCurrentUserOrAdmin],
      },
      { ...existingKeyPair, ...keyPair, ...existingKeyPair.principalIdentifier },
    );

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { id, rev } = keyPair;

    // Prepare the db object
    const dbObject = _.omit(this._fromRawToDbObject(keyPair, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // make sure the record being updated exists
          .key({ id })
          .rev(rev)
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The keyPair does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, {
          id,
          fields: ['id', 'updatedBy'],
        });
        if (existing) {
          throw this.boom.badRequest(
            `key-pair information changed just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`key-pair with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-key-pair', body: { id } });

    return this._fromDbToDataObject(result);
  }

  async delete(requestContext, { id }) {
    const existingKeyPair = await this.mustFind(requestContext, { id });

    // Make sure the user has permissions to delete the key-pair
    // By default, allow only active admin users or self
    await this.assertAuthorized(
      requestContext,
      { action: 'delete', conditions: [allowIfActive, allowIfCurrentUserOrAdmin] },
      { ...existingKeyPair, ...existingKeyPair.principalIdentifier },
    );

    // Lets now remove the item from the database
    await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)') // make sure the record being deleted exists
          .key({ id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`key-pair with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'delete-key-pair', body: { id } });
  }

  async activate(requestContext, { id, rev }) {
    return this.update(requestContext, { id, status: 'active', rev });
  }

  async deactivate(requestContext, { id, rev }) {
    return this.update(requestContext, { id, status: 'inactive', rev });
  }

  // Do some properties renaming to prepare the object to be saved in the database
  _fromRawToDbObject(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    return dbObject;
  }

  // Do some properties renaming to restore the object that was saved in the database
  _fromDbToDataObject(rawDb, overridingProps = {}) {
    if (_.isNil(rawDb)) return rawDb; // important, leave this if statement here, otherwise, your update methods won't work correctly
    if (!_.isObject(rawDb)) return rawDb;

    let keyPairPrincipalIdentifier = {};
    // If keypair has 'uid' then it's associated to some user
    if (rawDb.uid) {
      keyPairPrincipalIdentifier = { uid: rawDb.uid };
    }
    const dataObject = _.omit(
      { ...rawDb, principalIdentifier: keyPairPrincipalIdentifier, ...overridingProps },
      'uid', // remove uid as we are sending principalIdentifier object with shape { uid } instead
    );
    return dataObject;
  }

  async isAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.authorize" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    return isAllow(
      await authorizationService.authorize(
        requestContext,
        { extensionPoint: 'key-pair-authz', action, conditions },
        ...args,
      ),
    );
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'key-pair-authz', action, conditions },
      ...args,
    );
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  async generateKeyPairMaterial() {
    return new Promise((resolve, reject) => {
      generateKeyPair(
        'rsa',
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs1',
            format: 'pem',
            // cipher: 'aes-256-cbc',
            // passphrase: 'top secret',
            // passphrase: '',
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err);
          } else {
            resolve({ publicKey, privateKey });
          }
        },
      );
    });
  }

  async generateSshKeyPairMaterial() {
    const { publicKey, privateKey } = await this.generateKeyPairMaterial();
    const publicKeySsh = forge.ssh.publicKeyToOpenSSH(forge.pki.publicKeyFromPem(publicKey));
    const privateKeySsh = forge.ssh.privateKeyToOpenSSH(forge.pki.privateKeyFromPem(privateKey));
    return { publicKey: publicKeySsh, privateKey: privateKeySsh };
    // return { publicKey, privateKey };
  }
}

module.exports = KeyPairService;
