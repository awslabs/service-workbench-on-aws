const Service = require('@aws-ee/base-services-container/lib/service');

class ExternalCfnTemplateService extends Service {
  constructor() {
    super();
    this.dependency(['s3Service']);
  }

  async init() {
    await super.init();
  }

  async getSignS3Url(key) {
    const [s3Service] = await this.service(['s3Service']);
    const bucket = this.settings.get('externalCfnTemplatesBucketName');
    const request = { files: [{ key, bucket }] };
    const urls = await s3Service.sign(request);
    return urls[0].signedUrl;
  }

  async mustGetSignS3Url(key) {
    const result = await this.getSignS3Url(key);
    if (!result) throw this.boom.notFound(`template with key "${key}" does not exist`, true);
    return result;
  }
}

module.exports = ExternalCfnTemplateService;
