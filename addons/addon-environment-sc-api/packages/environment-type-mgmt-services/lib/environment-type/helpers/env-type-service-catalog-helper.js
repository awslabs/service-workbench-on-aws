async function getServiceCatalogClient(aws, roleArn, externalId) {
  // get service catalog client sdk with the service catalog admin role credentials
  const serviceCatalogClient = await aws.getClientSdkForRole({
    roleArn,
    clientName: 'ServiceCatalog',
    options: { apiVersion: '2015-12-10' },
    externalId,
  });
  return serviceCatalogClient;
}
module.exports = { getServiceCatalogClient };
