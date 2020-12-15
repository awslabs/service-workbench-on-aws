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
const crypto = require('crypto');
const Service = require('@aws-ee/base-services-container/lib/service');

const { CfnTemplate } = require('../helpers/cfn-template');

const extensionPoint = 'study-access-strategy';

const settingKeys = {
  envBootstrapBucket: 'envBootstrapBucketName',
};

const getCfnConsoleUrl = accountTemplateInfo => {
  // see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stacks-quick-create-links.html
  const { name, region, signedUrl } = accountTemplateInfo;
  const url = [
    `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review/`,
    `?templateURL=${encodeURIComponent(signedUrl)}`,
    `&stackName=${name}`,
  ].join('');

  return url;
};

class DataSourceRegistrationService extends Service {
  constructor() {
    super();
    this.dependency([
      'auditWriterService',
      'dataSourceAccountService',
      'dataSourceBucketService',
      'studyService',
      'pluginRegistryService',
      'lockService',
      's3Service',
    ]);
  }

  async registerAccount(requestContext, rawAccountEntity) {
    // We delegate to the data source account service
    const [accountService] = await this.service(['dataSourceAccountService']);

    return accountService.register(requestContext, rawAccountEntity);
  }

  async registerBucket(requestContext, accountId, rawBucketEntity) {
    // We delegate most of the work to the DataSourceBuckService including input validation.
    const [accountService, bucketService] = await this.service(['dataSourceAccountService', 'dataSourceBucketService']);
    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });

    return bucketService.register(requestContext, accountEntity, rawBucketEntity);
  }

  async registerStudy(requestContext, accountId, bucketName, rawStudyEntity) {
    const [accountService, bucketService, studyService, lockService] = await this.service([
      'dataSourceAccountService',
      'dataSourceBucketService',
      'studyService',
      'lockService',
    ]);

    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });
    const bucketEntity = await bucketService.mustFind(requestContext, { accountId, name: bucketName });

    // We do locking here because there could be other lambdas that are trying to register studies for the
    // same account and they might be updating the same application roles, etc.
    const result = await lockService.tryWriteLockAndRun({ id: `account-${accountId}-operation` }, async () => {
      const studyEntity = await studyService.register(requestContext, accountEntity, bucketEntity, rawStudyEntity);

      // We give a chance to the plugins to participate in the logic of registration. This helps us have different
      // study access strategies
      const pluginRegistryService = await this.service('pluginRegistryService');
      const outcome = await pluginRegistryService.visitPlugins(extensionPoint, 'onStudyRegistration', {
        payload: {
          requestContext,
          container: this.container,
          accountEntity,
          bucketEntity,
          studyEntity,
        },
      });

      return outcome;
    });

    // Write audit event
    await this.audit(requestContext, {
      action: 'register-study',
      body: { accountEntity: result.accountEntity, bucketEntity: result.bucketEntity, studyEntity: result.studyEntity },
    });

    return _.get(result, 'studyEntity');
  }

  async createAccountCfn(requestContext, accountId) {
    const [accountService, s3Service] = await this.service(['dataSourceAccountService', 's3Service']);
    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });
    const { id, mainRegion, stack, stackCreated } = accountEntity;
    const cfnTemplate = new CfnTemplate({ accountId: id, region: mainRegion });

    // We give a chance to the plugins to participate in the logic of create the account cfn. This helps us have different
    // study access strategies
    const pluginRegistryService = await this.service('pluginRegistryService');
    const result = await pluginRegistryService.visitPlugins(extensionPoint, 'provideAccountCfnTemplate', {
      payload: {
        requestContext,
        container: this.container,
        accountEntity,
        cfnTemplate,
      },
    });

    // Prepare the account template information. The id of the template is actually the hash of the content
    // of the template
    const accountTemplateInfo = {
      name: stack,
      region: mainRegion,
      accountId: id,
      created: stackCreated,
      template: result.cfnTemplate.toJson(),
    };
    const templateStr = JSON.stringify(accountTemplateInfo.template);

    // The id of the template is actually the hash of the of the content of the template
    const hash = crypto.createHash('sha256');
    hash.update(templateStr);
    accountTemplateInfo.id = hash.digest('hex');

    // Upload to S3
    const bucket = this.settings.get(settingKeys.envBootstrapBucket);
    const key = `data-sources/acct-${id}/cfn/region/${mainRegion}/${accountTemplateInfo.id}.json`;
    await s3Service.api
      .putObject({
        Body: templateStr,
        Bucket: bucket,
        Key: key,
      })
      .promise();

    // Sign the url
    const request = { files: [{ key, bucket }], expireSeconds: 604800 /* seven days */ };
    const urls = await s3Service.sign(request);
    const signedUrl = urls[0].signedUrl;

    accountTemplateInfo.signedUrl = signedUrl;
    accountTemplateInfo.cfnConsoleUrl = getCfnConsoleUrl(accountTemplateInfo);

    // Write audit event
    await this.audit(requestContext, {
      action: 'create-account-cfn',
      body: { accountEntity: result.accountEntity, accountTemplateInfo },
    });

    return accountTemplateInfo;
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

module.exports = DataSourceRegistrationService;
