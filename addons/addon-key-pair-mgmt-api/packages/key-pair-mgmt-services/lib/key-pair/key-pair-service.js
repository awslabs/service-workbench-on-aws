const _ = require('lodash');
const uuid = require('uuid/v4');
const { generateKeyPair } = require('crypto');
const forge = require('node-forge');

const Service = require('@aws-ee/base-services-container/lib/service');
const {
  isAllow,
  allowIfActive,
  allowIfCurrentUserOrAdmin,
} = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const createKeyPairSchema = require('./schema/create-key-pair');
const updateKeyPairSchema = require('./schema/update-key-pair');

const settingKeys = {
  tableName: 'dbTableKeyPairs',
};
const usernameIndexName = 'UsernameIndex';

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
      requestContext.principalIdentifier,
    );

    if (_.isEmpty(filterPrincipalIdentifier.username) || _.isEmpty(filterPrincipalIdentifier.ns)) {
      throw this.boom.badRequest(
        `Invalid principal filter specified. The principal filter must contain 'username' and 'ns'`,
        true,
      );
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

    const username = encodePrincipalIdentifier(filterPrincipalIdentifier);
    const result = await this._query()
      .index(usernameIndexName)
      .key('username', username) // return key-pairs associated with the specified principal
      .limit(2000)
      .projection(fields)
      .query();

    const dataObjects = _.map(result || [], k => this._fromDbToDataObject(k));
    return dataObjects;
  }

  async find(requestContext, { id, fields = [] }) {
    // Make sure 'username' is always returned as that's required for authorizing the 'get' action
    // If empty "fields" is specified then it means the caller is asking for all fields. No need to append 'username'
    // in that case.
    const fieldsToGet = _.isEmpty(fields) ? fields : _.uniq([...fields, 'username']);
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

        // pass key-pair along with username and ns.
        // The {username,ns} are required by the authorization logic in "allowIfCurrentUserOrAdmin"
        // keyPairObj.principalIdentifier has shape { username, ns }
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
    const createKeyPairFor = keyPair.username
      ? decodePrincipalIdentifier(keyPair.username) // keyPair.username includes ns
      : requestContext.principalIdentifier;

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

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(keyPair, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
      username: encodePrincipalIdentifier(createKeyPairFor),
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
    const existingKeyPair = await this.mustFind(requestContext, { id: keyPair.id });

    // Make sure the user has permissions to update the key-pair
    // By default, allow only active admin users or self
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfCurrentUserOrAdmin] },
      { ...existingKeyPair, ...keyPair, ...existingKeyPair.principalIdentifier },
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(keyPair, updateKeyPairSchema);

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns }
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
        const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `key-pair information changed by "${
              (existing.updatedBy || {}).username
            }" just before your request is processed, please try again`,
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
    // If keypair has 'username' then it's associated to some user
    if (rawDb.username) {
      // the keyPair.username includes ns
      // decode it to get principal identifier object with { username, ns }
      keyPairPrincipalIdentifier = decodePrincipalIdentifier(rawDb.username);
    }
    const dataObject = _.omit(
      { ...rawDb, principalIdentifier: keyPairPrincipalIdentifier, ...overridingProps },
      'username', // remove username as we are sending principalIdentifier object instead
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

function encodePrincipalIdentifier(principalIdentifier = {}) {
  return JSON.stringify(principalIdentifier);
}
function decodePrincipalIdentifier(
  principalIdentifierStr = '{}',
  errorMsg = 'Incorrect username specified. It must be a valid JSON string containing {username,ns}',
) {
  try {
    return JSON.parse(principalIdentifierStr);
  } catch (e) {
    throw this.boom.badRequest(errorMsg, true);
  }
}
module.exports = KeyPairService;
