/**
 * A function that validates the default service catalog product ID
 * specified by the defaultProductId setting is valid. The name of the
 * product should be "Integration Test"
 *
 * @param {Setup} setup
 */
async function validateDefaultServiceCatalogProduct(setup) {
  const serviceCatalog = await setup.aws.services.serviceCatalog();
  const defaultProductId = setup.settings.get('defaultProductId');
  const defaultProductName = await serviceCatalog.getProductName(defaultProductId);
  const expectedProductId = 'Integration Test';

  if (defaultProductName !== expectedProductId) {
    throw new Error(
      `The default product ID ${defaultProductId} refers to a product called ${defaultProductName} instead of ${expectedProductId}.` +
        'Please set defaultProductId as specified in the example.yml file.',
    );
  }
}

module.exports = { validateDefaultServiceCatalogProduct };
