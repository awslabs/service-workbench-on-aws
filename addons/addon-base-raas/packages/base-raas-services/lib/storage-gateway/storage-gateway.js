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
const storageGatewayDbRecord = require('../schema/storage-gateway-db-record');

// Webpack messes with the fetch function import and it breaks in lambda.
if (typeof fetch !== 'function' && fetch.default && typeof fetch.default === 'function') {
  fetch = fetch.default;
}

const settingKeys = {
  tableName: 'StorageGateway',
};

class StorageGateway extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'dbService', 'userService', 'jsonSchemaValidationService']);
  }

  async init() {
    // Get services
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    this._updater = () => dbService.helper.updater().table(table);
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
    await jsonSchemaValidationService.ensureValid(rawData, storageGatewayDbRecord);

    const by = _.get(requestContext, 'principalIdentifier.uid');
    // Prepare the db object
    const date = new Date().toISOString();
    const dbObject = this._fromRawToDbObject(rawData, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
      createdAt: date,
      updatedAt: date,
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

  // Do some properties renaming to prepare the object to be saved in the database
  _fromRawToDbObject(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    return dbObject;
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

module.exports = StorageGateway;
