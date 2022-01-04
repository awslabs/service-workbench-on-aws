/* eslint-disable no-await-in-loop */
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

const settingKeys = {
  environmentsBootstrapBucketName: 'environmentsBootstrapBucketName',
  studyDataBucketName: 'studyDataBucketName',
  deploymentBucketName: 'deploymentBucketName',
};

class EditS3BucketPolicyService extends Service {
  constructor() {
    super();
    this.dependency(['s3Service', 'lockService']);
  }

  async init() {
    await super.init();
    // Setup services and SDK clients
    [this.s3Service, this.lockService] = await this.service(['s3Service', 'lockService']);
    this.s3Client = this.s3Service.api;
  }

  async execute() {
    const environmentsBootstrapBucketName = this.settings.get(settingKeys.environmentsBootstrapBucketName);
    const studyDataBucketName = this.settings.get(settingKeys.studyDataBucketName);
    const deploymentBucketName = this.settings.get(settingKeys.deploymentBucketName);

    const dynamicBucketNames = [environmentsBootstrapBucketName, studyDataBucketName, deploymentBucketName];

    await Promise.all(
      dynamicBucketNames.map(async bucket => {
        await this.updateS3PoliciesForSecureTransport(bucket);
      }),
    );
  }

  async replaceS3BucketPolicyStatement(s3BucketName, oldStatementSid, newStatementSid, replacePattern) {
    this.log.info(`Attempting to update bucket policy for ${s3BucketName}`);

    // Perform locked updates to prevent inconsistencies from race conditions
    const s3LockKey = `s3|bucket-policy|${s3BucketName}`;
    // Update S3 bucket policy
    await this.lockService.tryWriteLockAndRun({ id: s3LockKey }, async () => {
      // Get existing policy
      const s3Policy = JSON.parse((await this.s3Client.getBucketPolicy({ Bucket: s3BucketName }).promise()).Policy);

      if (_.isEmpty(s3Policy)) {
        this.log.info(`No policy attached to ${s3BucketName}.`);
        return;
      }

      // Get statements
      const statements = s3Policy.Statement;
      let newStatements;

      if (replacePattern === 'HTTPS') {
        // Get TLS statement
        const tlsStatement = oldStatementSid;
        // Edit the TLS statement if found
        newStatements = statements.map(statement =>
          statement.Sid === tlsStatement
            ? { ...statement, Sid: newStatementSid, Resource: [statement.Resource, statement.Resource.split('/')[0]] }
            : { ...statement },
        );
      }

      // Add other replacement patterns here

      if (_.isEqual(newStatements, statements)) {
        this.log.info(`No Statement found`);
      } else {
        // Update policy if there was a change
        s3Policy.Statement = newStatements;
        try {
          await this.s3Client.putBucketPolicy({ Bucket: s3BucketName, Policy: JSON.stringify(s3Policy) }).promise();
        } catch (error) {
          this.log.info(
            `Failed updating bucket policy: ${JSON.stringify(
              s3Policy,
            )} for bucket: ${s3BucketName}. Check if original bucket policy is too large`,
          );
          this.log.info({ error });
          throw new Error('Updating S3 Bucket Policy(ies) failed. See previous log message for more details.');
        }
      }
    });
  }

  async updateS3PoliciesForSecureTransport(s3BucketName) {
    const oldStatementSid = 'Deny requests that do not use TLS';
    const newStatementSid = 'Deny requests that do not use TLS/HTTPS';
    const replacePattern = 'HTTPS';
    await this.replaceS3BucketPolicyStatement(s3BucketName, oldStatementSid, newStatementSid, replacePattern);
  }
}

module.exports = EditS3BucketPolicyService;
