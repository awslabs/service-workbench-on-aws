---
id: configuring_idp
title: Configuring an Identity Provider
sidebar_label: Configuring an Identity Provider
---

The solution uses Amazon Cognito User Pools to federate identities from Microsoft Active Directory using ADFS and SAML2.0.

From SAML federation point of view, the Cognito User Pool is the Service Provider (SP) and takes care of processing SAML assertions and the ADFS is the Identity Provider (IdP). We need to establish mutual trust between the SP and the IdP.

## Create a Relying Party (RP) in ADFS

These steps may vary based on your AD/ADFS version. Please contact your system administrator for configuring a relying party and setting up trust in Active Directory.

At high level the steps are as follows:

1. Login to your Active Directory Domain Controller Machine and type “AD FS” in the Run window and open “AD FS 2.0 Management”.
2. Click “Add Relying Party Trust”.
3. In “Welcome” screen: Click Start.
4. In “Select Data Source”: Select “Enter data about the relying party manually”.
5. In “Specify Display Name”: Enter some display name and notes about the relying party (For example, “Cognito User Pool Relying Party”).
6. In “Choose Profile”: Select “AD FS 2.0 Profile”.
7. In “Configure Certificate”: Do NOT configure any cert. This is for encrypting SAML claims. The SP (i.e., the Cognito User Pool in this case) need private key to decrypt the claims if you configure this. Amazon Cognito User Pools currently do not support encrypted SAML assertions.
8. In “Configure URL”: Do NOT select any box. Click Next.
9. In “Configure Identifiers”: Do not configure anything yet.
10. In “Choose Issuance Authorization Rules”: Select “Permit all users to access this relying party”.
11. In “Ready to Add Trust”: Click Next.
12. In “Finish”: Click Close.
13. Next we need to configure claim attributes we want to be part of the SAML assertion. These attributes will be read by Cognito User Pool and mapped into standard Cognito Attributes as per the mapping configuration on the Cognito side.
14. To configure claims, the “Edit Claims” window may already be open at this point from last wizard. If not, you can open it by clicking the “Edit Claim Rules” link.
15. To configure claims, the “Edit Claims” window may already be open at this point from last wizard. If not, you can open it by clicking the “Edit Claim Rules” link.
    1. Add the following claims:
       1. Name ID
       2. Name
       3. Mail
       4. Surname
       5. Given Name
16. To add Name ID claim:
    1. Click “Add Rule”.
    2. Select “Transform an Incoming Claim”, Click Next and then configure the Claim.
17. Similarly add Name claim.
18. To add E-Mail claim:
    1. Click “Add Rule”.
    2. Select “Send LDAP Attributes as Claims”, Click Next and then configure the Claim.
19. Similarly add the Surname and Given Name claims.

## Configure Relying Party information on the Service Workbench side

Once you have created a Relying Party in ADFS you can then configure it within the Research as a Service solution.

1. Extract the SAML metadata file from ADFS. The location of the metadata file may be different depending upon your version of AD/ADFS. Usually it is available at the following location: `https://<DomainControllerDNSName>/FederationMetadata/2007-06/FederationMetadata.xml.`
2. Copy the above metadata file and place it at `/solution/post-deployment/config/saml-metadata/metadata.xml`.
3. Adjust your component specific settings file for the post-deployment component at `/solution/post-deployment/config/settings/<your-environment-name>.yml` and specify the `fedIdpMetadatas` setting as follows:

```bash
fedIdpMetadatas: '["s3://${self:custom.settings.namespace}-artifacts/saml-metadata/metadata.xml"]'
```

## Add Relying Party trust for the Cognito User Pool on the ADFS side

When you deploy the solution following the [**Initial Deployment**](deployment) instructions, a Cognito User Pool is created. Follow these steps to add a Relying Party trust for the Cognito User Pool:

1. Log in to the AWS console and navigate to Amazon Cognito.
2. Select User Pools, you should see a user pool for your environment. The name of the Cognito User Pool will be in the following format `<envName>-<solutionName>-userpool`. The `<envName>` and the `<solutionName>` values here would be the values you specified for the corresponding settings in your settings file.
3. Select the user pool for your environment and take note of the following values:
   1. User pool ID: Copy the value for field “Pool Id”.
   2. Domain prefix: Navigate to “App integration  Domain name” for your user pool and copy the value of the domain prefix.
4. Login to your ADFS domain controller to add Cognito User Pool related information to configure trust.
   1. Open AD FS Management application.
   2. Navigate to “Relying Party Trusts”.
   3. Select the relying party you want to add trust to.
   4. Open the “Identifiers” tab.
   5. Enter the URN of the Cognito User Pool and click “Add”. The URN would be in the following format: `urn:amazon:cognito:sp:<userPoolId>`. Replace the `<userPoolId>` with the value of the User pool ID you obtained earlier.
   6. Open the “Endpoints” tab and add the Service Provider (Cognito SAML assertion consumer) URL that will receive the SAML assertion from IdP. The url has the following format: `https://<userPoolDomain>.auth.<region>.amazoncognito.com/saml2/idpresponse`. Replace `<userPoolDomain>` with the value of the “Domain prefix” you obtained earlier. Replace the value of `<region>` with the region where you deployed the solution to.

You should now be able to log in to the Research as a Service solution using your AD credentials.
