/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
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
const jwtDecode = require('jwt-decode');
const { retry } = require('@aws-ee/base-services/lib/helpers/utils');

const Settings = require('./utils/settings');
const { getClientSession } = require('./client-session');
const { getGenerators } = require('./utils/generators');
const { initAws } = require('./aws/init-aws');

/**
 * This class serves two main purposes:
 * - Contains the logic for the setup that is applicable to all test suites.
 * - The entry point to gain access to the default admin session or create other client sessions
 *
 * In your rests, you can simply use const setup = await runSetup(); to gain access to an instance of
 * this class.
 */
class Setup {
  constructor() {
    this.sessions = [];
  }

  async init() {
    // 1 - Read the global __settings__ object and turn it into the settings object, the __settings__ was
    //     made available in the globals by jest.config.js file
    // 2 - Use the adminIdToken from settings, to create the default admin session

    // eslint-disable-next-line no-undef
    const settingsInGlobal = __settings__;
    if (_.isEmpty(settingsInGlobal)) {
      throw Error(
        'No settings variable was found in the globals. Check jest.config.js to ensure that the logic that populates the __settings__ is executed.',
      );
    }

    // eslint-disable-next-line no-undef
    this.settings = new Settings(settingsInGlobal);
    this.apiEndpoint = this.settings.get('apiEndpoint');

    // value generators
    this.gen = await getGenerators({ setup: this });

    // aws instance
    this.aws = await initAws({ settings: this.settings });

    // An object to abstract out the default setup (eg. default test project)
    this.defaults = await this.getDefaults();

    // Retry failed tests up to three times
    jest.retryTimes(3);
  }

  async getNewAdminIdToken() {
    let apiEndpoint;

    // If isLocal = false, we get the api endpoint from the backend stack outputs
    if (this.settings.get('isLocal')) {
      apiEndpoint = this.settings.get('localApiEndpoint');
    } else {
      const cloudformation = await this.aws.services.cloudFormation();
      const stackName = this.aws.settings.get('backendStackName');
      apiEndpoint = await cloudformation.getStackOutputValue(stackName, 'ServiceEndpoint');
      if (_.isEmpty(apiEndpoint)) throw new Error(`No API Endpoint value defined in stack ${stackName}`);
    }

    // Get the admin password from parameter store
    const ssm = await this.aws.services.parameterStore();
    const passwordPath = this.settings.get('passwordPath');
    const password = await ssm.getParameter(passwordPath);

    // Get IdToken from Cognito IdP
    const userPoolId = this.settings.get('userPoolId');
    const appClientId = this.settings.get('appClientId');
    const cognito = await this.aws.services.cognitoIdp();

    const adminIdToken = await cognito.getIdToken({
      username: this.settings.get('username'),
      password,
      userPoolId,
      appClientId,
    });

    return adminIdToken;
  }

  async defaultAdminSession() {
    let idToken = this.settings.get('adminIdToken');
    const decodedIdToken = jwtDecode(idToken);
    const expiresAt = _.get(decodedIdToken, 'exp', 0) * 1000;

    // Assume the default admin session is shared between all test cases in a given test suite (ie. test file),
    // so it has to stay active throughout the test suite duration.
    // Therefore the buffer time (in minutes) should be the longest time taken by any single test suite
    // If the current token has less than the buffer minutes remaining, we create a new one.
    const bufferInMinutes = 25;
    const tokenExpired = (expiresAt - Date.now()) / 60 / 1000 < bufferInMinutes;

    // Only create a new client session if we haven't done that already or if the token has expired
    if (this.defaultAdminSessionInstance && !tokenExpired) return this.defaultAdminSessionInstance;

    // If previous token expired, we need to create a new id token for the default admin
    if (tokenExpired) {
      idToken = await this.getNewAdminIdToken();
      this.settings.set('adminIdToken', idToken);
    }

    const session = await getClientSession({ idToken, setup: this });
    this.sessions.push(session);
    this.defaultAdminSessionInstance = session;

    return session;
  }

  // For future enhancement, we can capture this in a different file similar to how we did the getGenerators() and getServices().
  async getDefaults() {
    const adminSession = await this.defaultAdminSession();
    const project = await adminSession.resources.projects.project(this.settings.get('projectId')).get();

    const indexId = project.indexId;
    const index = await adminSession.resources.indexes.index(indexId).get();

    const awsAccountId = index.awsAccountId;
    const awsAccount = await adminSession.resources.awsAccounts.awsAccount(awsAccountId).get();

    const envTypes = await {
      ec2Linux: {
        envTypeId: this.settings.get('ec2LinuxEnvTypeId'),
        envTypeConfigId: this.settings.get('ec2LinuxConfigId'),
      },
      ec2Windows: {
        envTypeId: this.settings.get('ec2WindowsEnvTypeId'),
        envTypeConfigId: this.settings.get('ec2WindowsConfigId'),
      },
      sagemaker: {
        envTypeId: this.settings.get('sagemakerEnvTypeId'),
        envTypeConfigId: this.settings.get('sagemakerConfigId'),
      },
      emr: {
        envTypeId: this.settings.get('emrEnvTypeId'),
        envTypeConfigId: this.settings.get('emrConfigId'),
      },
      rstudio: {
        envTypeId: this.settings.get('rstudioServerId'),
        envTypeConfigId: this.settings.get('rstudioServerConfigId'),
      },
    };

    const userPoolId = this.settings.get('userPoolId');
    const appClientId = this.settings.get('appClientId');
    const awsRegion = this.settings.get('awsRegion');

    const byobStudy = await this.settings.get('byobStudy');

    const stepTemplate = await adminSession.resources.stepTemplates
      .versions('st-obtain-write-lock')
      .version(1)
      .get();

    const workflowTemplateId = 'wt-empty';

    const isAppStreamEnabled = await this.settings.get('isAppStreamEnabled');

    return {
      isAppStreamEnabled,
      project,
      index,
      awsAccount,
      awsRegion,
      stepTemplate,
      workflowTemplateId,
      envTypes,
      byobStudy,
      appClientId,
      userPoolId,
      ...(await this.getConfigForAppStreamEnabledTests()),
    };
  }

  async getConfigForAppStreamEnabledTests() {
    const sagemakerEnvId = await this.settings.optional('sagemakerEnvId', '');
    const linuxEnvId = await this.settings.optional('linuxEnvId', '');
    const windowsEnvId = await this.settings.optional('windowsEnvId');

    return { sagemakerEnvId, linuxEnvId, windowsEnvId };
  }

  async createAdminSession() {
    const adminSession = await this.defaultAdminSession();
    const username = this.gen.username({ prefix: 'test-admin' });
    const password = this.gen.password();
    const firstName = this.gen.firstName();
    const lastName = this.gen.lastName();

    await adminSession.resources.users.create({
      username,
      email: username,
      isAdmin: true,
      userRole: 'admin',
      firstName,
      lastName,
      identityProviderName: 'Cognito Native Pool',
      authenticationProviderId: `https://cognito-idp.${this.defaults.awsRegion}.amazonaws.com/${this.defaults.userPoolId}`,
    });
    const idToken = await this.createCognitoUser({ username, password, fullName: `${firstName} ${lastName}` });

    const session = await getClientSession({ idToken, setup: this });
    this.sessions.push(session);

    return session;
  }

  async createResearcherSession({
    username = this.gen.username(),
    password = this.gen.password(),
    firstName = this.gen.firstName(),
    lastName = this.gen.lastName(),
    projectId = [this.defaults.project.id],
  } = {}) {
    const adminSession = await this.defaultAdminSession();
    await adminSession.resources.users.create({
      username,
      email: username,
      userRole: 'researcher',
      projectId,
      firstName,
      lastName,
      identityProviderName: 'Cognito Native Pool',
      authenticationProviderId: `https://cognito-idp.${this.defaults.awsRegion}.amazonaws.com/${this.defaults.userPoolId}`,
    });
    const idToken = await this.createCognitoUser({ username, password, fullName: `${firstName} ${lastName}` });

    const session = await getClientSession({ idToken, setup: this });
    this.sessions.push(session);
    return session;
  }

  async createUserSession({
    userRole = 'internal-guest',
    username = this.gen.username(),
    password = this.gen.password(),
    firstName = this.gen.firstName(),
    lastName = this.gen.lastName(),
    projectId = [this.defaults.project.id],
  } = {}) {
    const adminSession = await this.defaultAdminSession();
    await adminSession.resources.users.create({
      username,
      email: username,
      userRole,
      projectId,
      firstName,
      lastName,
      identityProviderName: 'Cognito Native Pool',
      authenticationProviderId: `https://cognito-idp.${this.defaults.awsRegion}.amazonaws.com/${this.defaults.userPoolId}`,
    });
    const idToken = await this.createCognitoUser({ username, password, fullName: `${firstName} ${lastName}` });

    const session = await getClientSession({ idToken, setup: this });
    this.sessions.push(session);

    return session;
  }

  async createCognitoUser({ username, password, fullName } = {}) {
    // Get IdToken from Cognito IdP
    const cognito = await this.aws.services.cognitoIdp();
    const appClientId = this.defaults.appClientId;
    const userPoolId = this.defaults.userPoolId;

    // Sign-up user in Cognito
    await cognito.signUpUser({ username, password, appClientId, fullName });

    const idToken = await cognito.getIdToken({
      username,
      password,
      userPoolId,
      appClientId,
    });
    return idToken;
  }

  async createAnonymousSession() {
    const session = await getClientSession({ setup: this });
    this.sessions.push(session);

    return session;
  }

  async cleanup() {
    // We need to reverse the order of the queue before we cleanup the sessions
    const sessions = _.reverse(_.slice(this.sessions));

    for (const session of sessions) {
      try {
        await session.cleanup();
      } catch (error) {
        console.error(error);
      }
    }

    this.sessions = []; // This way if the cleanup() method is called again, we don't need to cleanup again
  }
}

/**
 * Use this function to gain access to a setup instance that is initialized and ready to be used.
 */
async function runSetup() {
  const tryCreateSetup = async () => {
    const setupInstance = new Setup();
    await setupInstance.init();

    if (!setupInstance) throw Error('Setup instance did not initialize');
    return setupInstance;
  };

  // Retry 3 times using an exponential interval
  const setup = await retry(tryCreateSetup, 3);
  return setup;
}

module.exports = { runSetup };
