const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const createSchema = require('../schema/create-wf-assignment');
const updateSchema = require('../schema/update-wf-assignment');

const settingKeys = {
  tableName: 'dbTableWfAssignments',
};
const typeIndexName = 'TypeIndex';
const workflowIndexName = 'WorkflowIndex';

class WorkflowAssignmentService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'dbService', 'auditWriterService']);
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

  async find(requestContext, { id, fields = [] }) {
    const result = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    return this._fromDbToDataObject(result);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`workflow assignment with id "${id}" does not exist`, true);
    return result;
  }

  async listByTriggerType(requestContext, { triggerType, beginsWith, fields = [] }) {
    // beginsWith is optional
    let op = this._query()
      .index(typeIndexName)
      .key('triggerType', triggerType);

    if (!_.isEmpty(beginsWith)) op = op.sortKey('triggerTypeData').begins(beginsWith);

    const result = await op
      .limit(2000)
      .projection(fields)
      .query();

    return _.map(result, item => this._fromDbToDataObject(item));
  }

  async listByWorkflow(requestContext, { workflowId, fields = [] }) {
    if (!_.isString(workflowId) || _.isEmpty(workflowId)) throw this.boom.badRequest('workflow id is missing');

    const result = await this._query()
      .index(workflowIndexName)
      .key('wf', workflowId)
      .limit(2000)
      .projection(fields)
      .query();

    return _.map(result, item => this._fromDbToDataObject(item));
  }

  async create(requestContext, rawData) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(rawData, createSchema);

    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const { id } = rawData;

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(rawData, { rev: 0, createdBy: by, updatedBy: by });

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // yes we need this
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`workflow assignment with id "${id}" already exists`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'create-workflow-assignment', body: result });

    return result;
  }

  async update(requestContext, rawData) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(rawData, updateSchema);

    // For now, we assume that 'updatedBy' is always a user and not a group
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const { id, rev } = rawData;

    // Prepare the db object
    const dbObject = _.omit(this._fromRawToDbObject(rawData, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .rev(rev)
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The wf-assignment does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `workflow assignment information changed by "${
              (existing.updatedBy || {}).username
            }" just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`workflow assignment with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-workflow-assignment', body: result });

    return result;
  }

  async delete(requestContext, { id }) {
    // Lets now remove the item from the database
    const result = await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`workflow assignment with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'delete-workflow-assignment', body: { id } });

    return result;
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

    const dataObject = { ...rawDb, ...overridingProps };
    return dataObject;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = WorkflowAssignmentService;
