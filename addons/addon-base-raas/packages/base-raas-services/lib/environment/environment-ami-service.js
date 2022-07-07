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
const NodeCache = require('node-cache');
const Service = require('@amzn/base-services-container/lib/service');

const settingKeys = {
  enableAmiSharing: 'enableAmiSharing',
  devopsRoleArn: 'devopsRoleArn',
  devopsRoleExternalId: 'devopsRoleExternalId',
};

class EnvironmentAmiService extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
    this.cacheService = new NodeCache();
  }

  async init() {
    await super.init();
    this.ec2 = await this.getEc2Sdk();
  }

  async getLatest(amiPrefix) {
    const cacheKey = `${amiPrefix}-latestAMI`;
    const latest = this.cacheService.get(cacheKey);
    if (_.isEmpty(latest)) {
      const results = await this.list(amiPrefix);
      if (_.isEmpty(results)) {
        throw this.boom.notFound(
          `Unable to find the latest AMI with prefix ${amiPrefix} to create the environment`,
          true,
        );
      }
      const result = results[0];
      this.cacheService.set(cacheKey, result, 60 * 5);
      return result;
    }
    return latest;
  }

  async list(amiPrefix) {
    const params = {
      Filters: [
        {
          Name: 'name',
          Values: [`${amiPrefix}*`],
        },
      ],
    };
    const images = await this.ec2.describeImages(params).promise();
    const results = images.Images.map(image => {
      return {
        imageId: image.ImageId,
        createdAt: new Date(image.CreationDate),
        name: image.Name,
      };
    });

    return _.reverse(_.sortBy(results, ['createdAt']));
  }

  async ensurePermissions({ imageId, accountId }) {
    // First check if the image is already public.
    const { Images: images } = await this.ec2
      .describeImages({
        ImageIds: [imageId],
      })
      .promise();
    if (_.isEmpty(images)) {
      throw this.boom.notFound(`Unable to find the AMI with ID ${imageId} to create the environment`, true);
    }
    const image = images[0]; // Expecting only one
    if (image.Public) {
      // If image is already public, the given account already has permissions so return
      return;
    }

    const params = {
      ImageId: imageId,
      LaunchPermission: {
        Add: [
          {
            UserId: accountId,
          },
        ],
      },
    };
    await (async () => {
      try {
        const attributes = await this.ec2.modifyImageAttribute(params).promise();
        return attributes;
      } catch (err) {
        this.log.error(err);
        throw this.boom.badRequest(`Unable to modify permissions on the software image for the selected index.`, true);
      }
    })();
  }

  async getEc2Sdk() {
    const [aws] = await this.service(['aws']);
    const isAmiSharingEnabled = this.checkIfAmiSharingEnabled();
    let ec2Client;
    // Get Devops account client if AMI sharing enabled.
    if (isAmiSharingEnabled) {
      this.log.info(`AMI Sharing enabled. Reading SDK using DevOps account role`);
      const { roleArn, externalId } = this.getDevopsAccountDetails();
      ec2Client = await aws.getClientSdkForRole({
        roleArn,
        clientName: 'EC2',
        options: { apiVersion: '2015-12-10' },
        externalId,
      });
    } else {
      ec2Client = new aws.sdk.EC2();
    }
    return ec2Client;
  }

  getDevopsAccountDetails() {
    return {
      roleArn: this.settings.get(settingKeys.devopsRoleArn),
      externalId: this.settings.get(settingKeys.devopsRoleExternalId),
    };
  }

  checkIfAmiSharingEnabled() {
    return this.settings.getBoolean(settingKeys.enableAmiSharing);
  }
}

module.exports = EnvironmentAmiService;
