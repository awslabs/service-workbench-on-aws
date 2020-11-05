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
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const uuid = require('uuid/v1');
let fetch = require('node-fetch');
const createStorageGatewaySchema = require('../schema/create-storage-gateway');
const updateStorageGatewaySchema = require('../schema/update-storage-gateway');

// Webpack messes with the fetch function import and it breaks in lambda.
if (typeof fetch !== 'function' && fetch.default && typeof fetch.default === 'function') {
  fetch = fetch.default;
}

const settingKeys = {
  tableName: 'StorageGateway',
};

class StorageGatewayService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'dbService', 'userService', 'jsonSchemaValidationService']);
  }

  async init() {
    // Get services
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    this._updater = () => dbService.helper.updater().table(table);
    this._getter = () => dbService.helper.getter().table(table);
  }

  async activateGateway(requestContext, rawData) {
    // 1. Fetch the public IP address of EC2 instance and make http request to get the activation key.
    // 2. Use the activation key and create a new Storage Gateway. Note that activateGateway is actually creating a
    // new gateway
    const user = await this.getUser(requestContext);
    const ipaddress = await this.fetchIP();
    this.log.info(`Whiteliting IP address ${ipaddress.origin}`);
    // whitelist the ipaddress making this request
    const authorizeSecurityGroupParams = {
      GroupId: rawData.securityGroup,
      IpPermissions: [
        {
          FromPort: 80,
          IpProtocol: 'tcp',
          IpRanges: [
            {
              CidrIp: `${ipaddress}/32`,
              Description: 'Temporary SSH access from Lambda function',
            },
          ],
          ToPort: 80,
        },
      ],
    };
    const ec2 = await this.getEC2();
    await ec2.authorizeSecurityGroupIngress(authorizeSecurityGroupParams).promise();
    let gatewayARN;
    try {
      const activationUrl = await this.fetchRedirect(
        `http://${rawData.publicIp}/?activationRegion=${rawData.region}&gatewayType=FILE_S3`,
      );
      const activationKey = activationUrl.match(/activationKey=[A-Z0-9-]+/)[0].split('=')[1];

      const activateGatewayParams = {
        ActivationKey: activationKey,
        GatewayName: uuid(),
        GatewayRegion: rawData.region,
        GatewayTimezone: rawData.timezone,
        GatewayType: 'FILE_S3',
        Tags: [
          {
            Key: 'CreatedBy',
            Value: user.username,
          },
        ],
      };
      const storageGateway = await this.getStorageGateway();
      const activateGatewayOutput = await storageGateway.activateGateway(activateGatewayParams).promise();
      gatewayARN = activateGatewayOutput.GatewayARN;
    } finally {
      await ec2.revokeSecurityGroupIngress(authorizeSecurityGroupParams).promise();
    }
    return gatewayARN;
  }

  /**
   * Create NFS file share in an existing Storage Gateway
   * @param requestContext
   * @param gatewayArn: Arn of the Storage Gateway for file share creation(The method assumes there's still capacity for another file share in this gateway)
   * @param s3LocationArn: Arn and path for S3 location. (Path under S3 bucket must end with '/')
   * @param roleArn: Arn of the role that has access to the S3 location and list Storage Gateway as a trusted entity
   * @param overrideParameters: Other parameters that you wish to override
   * @return Arn of existing file share if one is already created for the S3 path; Arn of newly created file share if there isn't one for the S3 path
   * See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/StorageGateway.html#createNFSFileShare-property for complete list of parameters for override
   */
  async createFileShare(requestContext, gatewayArn, s3LocationArn, roleArn, overrideParameters = {}) {
    // Check if there's an existing file share
    // The record 'file_shares' is used to keep track of all file shares so we don't need to scan the table for all file shares
    // The size limit of one DDB item 400KB, the record 'file_shares' can store up to 3,000 file shares
    let existingFileShare;
    try {
      existingFileShare = await this._getter()
        .key({
          id: 'file_shares',
        })
        .projection('file_share_s3_locations')
        .get();
      existingFileShare = existingFileShare.file_share_s3_locations;
      if (s3LocationArn in existingFileShare) {
        return existingFileShare[s3LocationArn];
      }
      this.log.info(`File share for ${s3LocationArn} does not exist, continue to create file share.`);
    } catch (e) {
      existingFileShare = {};
      this.log.info(`File share does not exist, continue to create file share.`);
    }

    const existingSG = await this.mustFind(requestContext, { id: gatewayArn });
    const storageGateway = await this.getStorageGateway();
    const clientToken = uuid();
    const params = {
      ClientToken: clientToken,
      GatewayARN: gatewayArn,
      LocationARN: s3LocationArn,
      Role: roleArn,
      ClientList: [`${existingSG.elasticIP}/32`],
    };
    const result = await storageGateway.createNFSFileShare({ ...params, ...overrideParameters }).promise();
    const fileShareArn = result.FileShareARN;
    // Update storage gateway record
    let newFileShares = {};
    if ('fileShares' in existingSG) {
      newFileShares = existingSG.fileShares;
    }
    newFileShares[s3LocationArn] = fileShareArn;
    await this.update(requestContext, { fileShares: newFileShares }, gatewayArn);
    // Create or update file_shares record
    existingFileShare[s3LocationArn] = fileShareArn;
    await this._updater()
      .key({
        id: 'file_shares',
      })
      .item({ file_share_s3_locations: existingFileShare })
      .update();
    return fileShareArn;
  }

  async fetchIP() {
    const ipAddressResult = await fetch('http://httpbin.org/get').then(function(res) {
      return res.json();
    });
    return ipAddressResult.origin;
  }

  async fetchRedirect(url) {
    const original = await fetch(url);
    return original.url;
  }

  async listLocalDisks(requestContext, gatewayARN) {
    const gatewayARNParam = {
      GatewayARN: gatewayARN,
    };
    const storageGateway = await this.getStorageGateway();
    const localDisks = await storageGateway.listLocalDisks(gatewayARNParam).promise();
    return localDisks;
  }

  async deleteGateway(requestContext, gatewayARN) {
    const gatewayARNParam = {
      GatewayARN: gatewayARN,
    };
    const storageGateway = await this.getStorageGateway();
    await storageGateway.deleteGateway(gatewayARNParam).promise();
  }

  async addCacheToGateway(requestContext, rawData) {
    // 1. List Local disks in gateway and
    // 2. Attach the disk which is available and matches the volume spec
    const volumeIds = {
      VolumeIds: [rawData.volumeId],
    };
    const ec2 = await this.getEC2();
    const volumeOutput = await ec2.describeVolumes(volumeIds).promise();
    const diskNode = volumeOutput.Volumes[0].Attachments[0].Device;
    const diskSizeBytes = volumeOutput.Volumes[0].Size * 1024 * 1024 * 1024;
    const localDisksOutput = await this.listLocalDisks(requestContext, rawData.gatewayARN);
    const ebsDiskToAdd = localDisksOutput.Disks.filter(disk => disk.DiskStatus.toLowerCase() === 'present')
      .filter(disk => disk.DiskNode === diskNode)
      .filter(disk => disk.DiskAllocationType.toLowerCase() === 'available')
      .filter(disk => disk.DiskSizeInBytes === diskSizeBytes)[0];
    const addToCacheParams = {
      DiskIds: [ebsDiskToAdd.DiskId],
      GatewayARN: rawData.gatewayARN,
    };
    const storageGateway = await this.getStorageGateway();
    await storageGateway.addCache(addToCacheParams).promise();
  }

  async saveToDDB(requestContext, rawData, id) {
    // Validate input
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    await jsonSchemaValidationService.ensureValid(rawData, createStorageGatewaySchema);

    const by = _.get(requestContext, 'principalIdentifier.uid');
    // Prepare the db object
    const dbObject = this._fromRawToDbObject(rawData, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
    });
    // Time to save the the db object
    let dbResult;
    try {
      dbResult = await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_not_exists(id)') // ensure that id doesn't already exist
            .key({ id })
            .item(dbObject)
            .update();
        },
        async () => {
          throw new Error(`Storage Gateway with id "${id}" already exists`);
        },
      );
    } catch (error) {
      this.log.log(error);
    }
    return dbResult;
  }

  async find(requestContext, { id, fields = [] }) {
    // Make sure 'createdBy' is always returned
    // If empty "fields" is specified then it means the caller is asking for all fields. No need to append 'createdBy'
    // in that case.
    const fieldsToGet = _.isEmpty(fields) ? fields : _.uniq([...fields, 'createdBy']);
    const result = await this._getter()
      .key({ id })
      .projection(fieldsToGet)
      .get();
    return this._fromDbToDataObject(result);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`storage gateway with id "${id}" does not exist`, true);
    return result;
  }

  async update(requestContext, rawData, id) {
    // Validate input
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    await jsonSchemaValidationService.ensureValid(rawData, updateStorageGatewaySchema);

    // Retrieve the existing environment, this is required for authorization below
    const existingSG = await this.mustFind(requestContext, { id });

    const by = _.get(requestContext, 'principalIdentifier.uid');
    // Prepare the db object
    const dbObject = this._fromRawToDbObject(rawData, {
      rev: existingSG.rev,
      updatedBy: by,
    });
    // Time to save the the db object

    const dbResult = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // ensure that id doesn't already exist
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The record does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `environment information changed just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`Storage gateway with id "${id}" does not exist`, true);
      },
    );
    return dbResult;
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

  async getUser(requestContext) {
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const userService = await this.service('userService');
    const user = await userService.mustFindUser({ uid: by });
    return user;
  }

  async getStorageGateway() {
    const aws = await this.getAWS();
    return new aws.sdk.StorageGateway();
  }

  async getEC2() {
    const aws = await this.getAWS();
    return new aws.sdk.EC2();
  }

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }
}

module.exports = StorageGatewayService;
