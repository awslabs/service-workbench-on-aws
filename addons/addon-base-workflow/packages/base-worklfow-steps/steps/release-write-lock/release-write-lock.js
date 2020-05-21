const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');

class ReleaseWriteLock extends StepBase {
  async start() {
    const tokenKeyName = await this.config.string('writeTokenKeyName');
    const writeToken = await this.payload.optionalString(tokenKeyName);
    const lockService = await this.mustFindServices('lockService');

    if (writeToken) {
      await lockService.releaseWriteLock({ writeToken });
      await this.payload.removeKey(tokenKeyName);
      await this.statusMessage(`Released write token "${writeToken}"`);
    } else {
      this.statusMessage('WARN|||No write token is found in the payload, therefore, no write lock to release');
    }
  }

  async inputKeys() {
    const keys = {
      writeTokenKeyName: 'string',
    };
    const tokenKeyName = await this.config.string('writeTokenKeyName');
    keys[tokenKeyName] = 'optionalString';
    return keys;
  }
}

module.exports = ReleaseWriteLock;
