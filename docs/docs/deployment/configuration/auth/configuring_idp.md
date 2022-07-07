---
id: configuring_idp
title: Configuring an Identity Provider
sidebar_label: Configuring an Identity Provider
---

Service Workbench on AWS uses Amazon Cognito User Pools to federate identities from Microsoft Active Directory using ADFS and SAML2.0.

For SAML federation, the Amazon Cognito User Pool is the Service Provider (SP). The SP processes SAML assertions and the ADFS is the Identity Provider (IdP). Mutual trust between the SP and the IdP must be established.

## Create a Relying Party (RP) in ADFS

These steps may vary based on your AD/ADFS version. Please contact your system administrator to configure a relying party and establish trust with Microsoft Active Directory.

To create a relying party, complete these steps:

1.  Login to your Active Directory Domain Controller Machine. Type `AD FS` in the ‘**Run**’ window and open ‘**AD FS 2.0 Management**’.
2.  Select ‘**Add Relying Party Trust**’.
3.  In the ‘**Welcome**’ screen, click ‘**Start**’.
4.  In the ‘**Select Data Source**’ pane, select ‘**Enter Data About the Relying Party Manually**’.
5.  In the ‘**Specify Display Name**’ pane, enter a display name and relevant notes about the relying party. For example, a user could enter in, ‘**Cognito User Pool Relying Party**’.
6.  In the ‘**Choose Profile**’ pane, select ‘**AD FS 2.0 Profile**’.
7.  ***DO NOT*** configure any certificate in the ‘**Configure Certificate**’ pane. Configuring certificates is for encrypting SAML claims. The SP (i.e., the Amazon Cognito User Pool) will need a private key to decrypt the claims if you configure a certificate, and Amazon Cognito User Pools do not currently support encrypted SAML assertions.
8.  ***DO NOT*** select any box in the ‘**Configure URL**’ pane. Click ‘**Next**’.
9.  At this point, there is no need to configure anything in the ‘**Configure Identifiers**’ pane.
10. In the ‘**Choose Issuance Authorization Rules**’ pane, select ‘**Permit All Users to Access this Relying Party**'.
11. In the ‘**Ready to Add Trust**’, click ‘**Next**’.
12. In the ‘**Finish**’ pane, select ‘**Close**’.
13. Next, configure the attributes that you want for the SAML assertion. The attributes will be read by the Amazon Cognito User Pool and aligned to the standard Amazon Cognito Attributes from the mapping configuration in Amazon Cognito.
14. The ‘**Edit Claims**’ window may already be open from the last wizard. If not, you can open it by clicking the ‘**Edit Claim Rules**’ link and configure the claims. 
 - Add the following claims:
  - **Name ID**
  - **Name**
  - **Mail**
  - **Surname**
  - **Given Name**
15. To add a **Name ID** claim:
 – Click ‘**Add Rul**e’.
 – Select ‘**Transform an Incoming Claim**’, then select ‘**Next**’ and then configure the claim.
16. Follow the same actions from **Step 15** to add the ‘**Name**’ claim.
17. To add the ‘**E-Mail**’ claim:
 – Select ‘**Add Rule**’.
 – Select ‘**Send LDAP Attributes as Claims**’, click ‘**Next**’ and then configure the claim.
18. Similarly, add the **Surname** and **Given Name** claims.

## Configure Relying Party information on the Service Workbench side

Once you have created a **Relying Party in ADFS**, you can then configure it within the Service Workbench solution. Complete the following steps to configure the relying party. 

1. Extract the SAML metadata file from ADFS. The location of the metadata file may be different depending upon your version of AD/ADFS. It is usually available at the following location:

```
https://<DomainControllerDNSName>/FederationMetadata/2007-06/FederationMetadata.xml
```

2. Copy the above metadata file and place it at the following location: 

```
/solution/post-deployment/config/saml-metadata/metadata.xml
```

3. Adjust your component specific settings file for the post-deployment component at the following location:

```
/solution/post-deployment/config/settings/<your-environment-name>.yml
```

4. Specify the `fedIdpMetadatas` setting as follows:

```
fedIdpMetadatas: '["s3://${self:custom.settings.namespace}-artifacts/saml-metadata/metadata.xml"]'
```

## Add Relying Party trust for the Cognito User Pool on the ADFS side

Once you have deployed the solution, an Amazon Cognito User Pool will be created. Follow the steps below to add a **Relying Party** trust for the Amazon Cognito User Pool:

1.  Log in to the AWS Management Console and navigate to Amazon Cognito.
2.  Select ‘**User Pool**’ to see a **User Pool** for your environment. The name of the Amazon Cognito User Pool will be in the format below—the `<envName>` and the `<solutionName>` values here would be the values you specified for the corresponding settings in your ‘**Settings**’ file.

```
  <envName>-<solutionName>-userpool
```

3.  Select the **User Pool** for your environment and take note of the following values:
 – **User Pool ID**: Copy the value for field **Pool ID**.
 – **Domain Prefix**: Navigate to ‘**App Integration Domain Name**’ for your **User Pool** and copy the value of the **Domain Prefix**.
4.  Login to your ADFS domain controller to add the Amazon Cognito User Pool-related information to configure trust.
 – Open the ADFS Management application.
 – Navigate to ‘**Relying Party Trusts**’.
 – To add trust, select the appropriate **Relying Party**.
 – Open the ‘**Identifiers**’ tab.
 – Enter the URN of the Amazon Cognito User Pool and click ‘**Add**’. Replace the `<userPoolId>` with the value of the **User Pool ID** you obtained earlier. The URN is in the following format: 
  - `urn:amazon:cognito:sp:<userPoolId>`
 – Open the ‘**Endpoints**’ tab and add the SP URL that will receive the SAML assertion from the IdP. The SP is the consumer of the Amazon Cognito SAML assertion. Replace `<userPoolDomain>` with the value of the **Domain Prefix** you obtained earlier. Replace the value of `<region>` with the region you deployed the solution. The URL is in the following format: 
    - `https://<userPoolDomain>.auth.<region>.amazoncognito.com/saml2/idpresponse`

You should now be able to log in to the Service Workbench solution using your Active Directory credentials.

