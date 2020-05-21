const SageMaker = require('aws-sdk/clients/sagemaker');

export default class SageMakerService {
  constructor(accessKeyId, secretAccessKey, region = 'us-east-1') {
    if (accessKeyId) {
      this.sm = new SageMaker({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      });
    } else {
      this.sm = new SageMaker({
        sslEnabled: true,
      });
    }
  }

  async getPresignedNotebookInstanceUrl(notebookInstanceName) {
    const params = {
      NotebookInstanceName: notebookInstanceName,
    };
    return this.sm.createPresignedNotebookInstanceUrl(params).promise();
  }
}
