const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { allowIfHasRole } = require('../user/helpers/user-authz-utils');

class EnvironmentSpotPriceHistoryService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'authorizationService']);
  }

  async getPriceHistory(requestContext, type) {
    // ensure that the caller has permissions to get price history
    // Perform default condition checks to make sure the user is active and has allowed roles
    const allowIfHasCorrectRoles = (reqContext, { action }) =>
      allowIfHasRole(reqContext, { action, resource: 'environment-spot-price-history' }, [
        'admin',
        'researcher',
        'external-researcher',
      ]);

    await this.assertAuthorized(
      requestContext,
      { action: 'read', conditions: [allowIfActive, allowIfHasCorrectRoles] },
      type,
    );

    const aws = await this.service('aws');

    const ec2 = new aws.sdk.EC2();

    const { SpotPriceHistory } = await runAndCatch(
      async () =>
        ec2
          .describeSpotPriceHistory({
            InstanceTypes: [type],
            ProductDescriptions: ['Linux/UNIX'],
            StartTime: new Date(),
          })
          .promise(),
      async () => {
        throw this.boom.badRequest(`Price history not available for "${type}" instance type.`);
      },
    );

    return SpotPriceHistory.map(({ AvailabilityZone, SpotPrice }) => ({
      availabilityZone: AvailabilityZone,
      spotPrice: parseFloat(SpotPrice),
    }));
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'environment-spot-price-history-authz', action, conditions },
      ...args,
    );
  }
}

module.exports = EnvironmentSpotPriceHistoryService;
