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
const Service = require('@aws-ee/base-services-container/lib/service');

class EnvironmentAmiService extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
    this.cacheService = new NodeCache();
  }

  async init() {
    await super.init();
    const aws = await this.service('aws');
    this.ec2 = new aws.sdk.EC2();
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
    const result = await (async () => {
      try {
        const attributes = await this.ec2.modifyImageAttribute(params).promise();
        return attributes;
      } catch (err) {
        this.log.error(err);
        throw this.boom.badRequest(`Unable to modify permissions on the software image for the selected index.`, true);
      }
    })();
    return result;
  }
}

module.exports = EnvironmentAmiService;
