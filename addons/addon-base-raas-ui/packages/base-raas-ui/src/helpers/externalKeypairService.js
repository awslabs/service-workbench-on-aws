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

const EC2 = require('aws-sdk/clients/ec2');
const SSM = require('aws-sdk/clients/ssm');

const paramStoreRoot = 'raas';

export default class EnvironmentKeypairService {
  constructor({ accessKeyId, secretAccessKey, region = 'us-east-1' }) {
    if (accessKeyId) {
      this.ec2 = new EC2({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      });
      this.ssm = new SSM({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      });
    } else {
      this.ec2 = new EC2({
        sslEnabled: true,
      });
      this.ssm = new SSM({
        sslEnabled: true,
      });
    }
  }

  async create(id) {
    const keyPair = await this.ec2.createKeyPair({ KeyName: id }).promise();

    const parameterName = `/${paramStoreRoot}/environments/${id}`;
    await this.ssm
      .putParameter({
        Name: parameterName,
        Type: 'SecureString',
        Value: keyPair.KeyMaterial,
        Description: `ssh key for environment ${id}`,
        Overwrite: true,
      })
      .promise();

    return keyPair.KeyName;
  }

  async mustFind(id) {
    const parameterName = `/${paramStoreRoot}/environments/${id}`;
    const privateKey = await this.ssm
      .getParameter({
        Name: parameterName,
        WithDecryption: true,
      })
      .promise();

    return { privateKey: privateKey.Parameter.Value };
  }

  async delete(id) {
    const parameterName = `/${paramStoreRoot}/environments/${id}`;

    await this.ec2.deleteKeyPair({ KeyName: id }).promise();

    await this.ssm
      .deleteParameter({
        Name: parameterName,
      })
      .promise();

    return true;
  }
}
