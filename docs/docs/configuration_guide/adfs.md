---
id: adfs
title: Configuring Service Workbench using Microsoft Active Directory Federation Services
sidebar_label: Configuring Service Workbench using Microsoft Active Directory Federation Services
---

Microsoft ADFS is another IdP and it uses SAML 2.0 standard. For SAML federation, the Amazon Cognito user pool is the Service Provider (SP). Mutual trust between the SP and the IdP must be established. Service Workbench on AWS uses Amazon Cognito user pools to federate identities from Microsoft Active Directory using ADFS and SAML 2.0. 

### Creating a Relying Party in Microsoft ADFS

Follow these steps to establish trust from the IdP (Microsoft ADFS) to Service Provider (Amazon Cognito user pool) and create a relying party in Microsoft ADFS. See [Service Workbench and IdP workflow](/configuration_guide/workflow).

#### Establishing trust between Microsoft ADFS (IdP) and Amazon Cognito user pool

1. Log in to your Active Directory domain controller. Type `AD FS` in the **Run** window and open **AD FS 2.0 Management**.
2. Choose **Add Relying Party Trust**.
3. Choose **Start** on the **Welcome** screen.
4. For **Select Data Source**, choose **Enter Data About the Relying Party Manually**.
5. For **Specify Display Name** pane, enter a display name and relevant notes about the relying party. For example, enter `Amazon Cognito User Pool Relying Party`.
6. For **Choose Profile**, choose **AD FS 2.0 Profile**.
7. Do not configure any certificate in the **Configure Certificate** pane. Configuring certificates is for encrypting SAML claims. The SP (that is, the Amazon Cognito user pool) needs a private key to decrypt the claims if you configure a certificate. The Amazon Cognito user pool does not currently support encrypted SAML assertions.
8. Do not select any option in the **Configure URL** pane. Choose **Next**.
9. At this point, there is no need to configure anything in the **Configure Identifiers** pane.
10. In the **Choose Issuance Authorization Rules** pane, choose **Permit All Users to Access this Relying Party**.
11. For **Ready to Add Trust**, choose **Next**.
12. For **Finish**, choose **Close**.

#### Configuring IdP attributes

1. Configure the attributes that you want for the SAML assertion. The attributes are read by the Amazon Cognito user pool and aligned to the standard Amazon Cognito attributes from the mapping configuration in Amazon Cognito.
2. The **Edit Claims** window may already be open from the last wizard. If not, you can open it by choosing the **Edit Claim Rules** link and configure the claims. Add the following claims:
      + **Name ID** (Optional)
      + **Name**
      + **Email**
      + **Surname**
      + **Given Name**
3. For **Name ID** claim, choose **Add Rule**.
4. Choose **Transform an Incoming Claim**, then choose **Next** and configure the claim.
5. Follow the same actions from to add the **Name** claim.
6. To add the **Email** claim, choose **Add Rule**. 
7. For **Send LDAP Attributes as Claims**, choose **Next** and then configure the claim.
8. Similarly, add the **Surname** and **Given Name** claims.

### Configuring relying party information in Service Workbench

After creating a relying party in Microsoft ADFS, you can configure it within the Service Workbench. Follow these steps to configure the relying party.

1. Extract the SAML metadata file from Microsoft ADFS. The location of the metadata file might be different depending upon your version of Microsoft AD/ADFS. By default, it is located at:

`https://<DomainControllerDNSName>/FederationMetadata/2007-06/FederationMetadata.xml`

2. Copy the metadata file and place it at the following location: 

`/solution/post-deployment/config/saml-metadata/metadata.xml`

3. Modify the component-specific settings file for post-deployment.

`/solution/post-deployment/config/settings/<your-environment-name>.yml`

4. Enter the following `fedIdpMetadatas` settings:

`fedIdpMetadatas: '["s3://${self:custom.settings.namespace}-artifacts/saml-metadata/metadata.xml"]'`

### Adding relying party trust for the Amazon Cognito user pool in Microsoft ADFS

After you have deployed the solution, an Amazon Cognito user pool is created. Follow these steps to add relying party trust for the Amazon Cognito user pool:

1. Sign in to the AWS Management Console and navigate to Amazon Cognito.
2. Choose User Pool to see a user pool for your environment. The Amazon Cognito user pool is specified in the following format:
`envName-solutionName-userpool`
where, `envName` and `solutionName` denote the values specified in your settings file.
3. Choose the user pool for your environment and note the following values:
      + **User Pool ID**: Copy the value for **Pool ID**. 
      + **Domain Prefix**: Navigate to **App Integration domain Name** for your user pool and copy the value of the **Prefix** domain.
4. Log in to Microsoft ADFS domain controller and add the Amazon Cognito user pool-related information.
      <ol type="a">
      <li>Open the Microsoft ADFS Management application.</li>
      <li> Navigate to <b>Relying Party Trusts</b>.</li>
      <li> To add trust, choose the appropriate relying party.</li>
      <li> Open the <b>Identifiers</b> tab. </li>
      <li> Enter the URN of the Amazon Cognito User Pool and choose <b>Add</b>.</li>
      </ol>

5. Replace the `userPoolId` with the value of the user pool ID you obtained earlier. The URN has the following format: 
     `urn:amazon:cognito:sp:userPoolId`
6. Open the **Endpoints** tab and add the SP URL that receives the SAML assertion from the IdP. The SP is the consumer of the Amazon Cognito SAML assertion. 
7. Replace `userPoolDomain` with the value of the `Prefix` domain. 
8. Replace `region` with the region in which you deployed the solution. The URL is in the following format: 

     `https://<userPoolDomain>.auth.<region>.amazoncognito.com/saml2/idpresponse`

You should now be able to log in to Service Workbench using Microsoft Active Directory credentials.
