---
id: auth0
title: Configuring Service Workbench using Auth0
sidebar_label: Configuring Service Workbench using Auth0
---

import useBaseUrl from '@docusaurus/useBaseUrl';

You can configure Service Workbench using Auth0 by first creating an application in Auth0. Next, configure SAML and download the SAML template. Finally, configure the Service Workbench environment.

## Configuring Auth0

Auth0 is another IdP, which used for adding authentication and authorization to your applications. Service Workbench on AWS can be configured to authenticate users through Auth0 and SAML2. For more information about using Auth0, see [Test SAML SSO with Auth0 as Service Provider and Identity Provider](https://auth0.com/docs/protocols/saml-protocol/configure-auth0-as-service-and-identity-provider). 
 
### Prerequisites

You must have an existing account with [Auth0](https://auth0.com/). 

### Creating an application using Auth0

To create an application:

1. Log in to your [Auth0](https://auth0.com/) account and navigate to the **Applications** page. 
2. If an application does not already exist, choose **Create Application**.

<img src={useBaseUrl('img/deployment/post_deployment/auth01.png')} /> 
 

**Figure 1: Applications webpage of Auth0.com**

3. Select the application type as **Single Page Web Applications** and choose **Create**.

<img src={useBaseUrl('img/deployment/post_deployment/auth02.png')} /> 
 

**Figure 2: Application types**

## Configuring SAML2

SAML is an XML-based open standard for transferring identity data between two parties: an identity provider (IdP) and a service provider (SP). For more information about SAML authentication, see [How does SAML Authentication Work?](https://auth0.com/blog/how-saml-authentication-works/#How-does-SAML-Authentication-Work-)

To configure SAML2: 

1. Navigate to the **Addons** tab and enable **SAML2 WEB APP**.

<img src={useBaseUrl('img/deployment/post_deployment/auth03.png')} /> 

**Figure 3: Addons tab for Single Page Web Applications**

2. In the **Application Callback URL** field, enter the following URL. Replace `STAGE_NAME` and `SOLUTION_NAME` with the values from the Service Workbench settings file and `REGION` with the appropriate region.

`https://STAGE_NAME-SOLUTION_NAME.auth.REGION.amazoncognito.com/saml2/idpresponse`
 
<img src={useBaseUrl('img/deployment/post_deployment/auth04.png')} /> 

**Figure 4: Application callback URL page and settings**

3. Enter the JSON code into the settings block and  replace `<USER_POOL_ID>` with the Service Workbench Amazon Cognito user pool ID value found in the Amazon Cognito console. 

4. Enter same values for the `<STAGE_NAME>`, `<SOLUTION_NAME>`, and `<REGION>` as in the previous step. 
5. After entering JSON with the appropriate values, scroll to the bottom and choose **Save**.

```
{
"audience": "urn:amazon:cognito:sp:USER_POOL_ID",
"Mappings": {
"Email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
"name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
"given_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
"family_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
},
"logout": {
"callback": "https://STAGE_NAME-SOLUTION_NAME.auth.REGION.amazoncognito.com/saml2/logout"
},
"nameIdentifierFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"
}
```
For more information about IdP workflow, see [Service Workbench and IdP workflow](/configuration_guide/workflow).

## Downloading SAML2 template

To download SAML metadata:

1. Choose **SAML2 Web App** again, and go to the **Usage** tab. 
2. Choose **Download** to download the SAML metadata XML file locally.
 
<img src={useBaseUrl('img/deployment/post_deployment/auth05.png')} /> 

**Figure 5: Usage tab of the SAML2 web application**

3. Rename and place the downloaded file in the repository at the following location:

`main/solution/post-demployment/config/saml-metadata/auth0_com-metadata.xml`

## Configuring Service Workbench environment

Add the following items to the `$STAGE.yml` settings file for the environment (replace `DOMAIN` with your Auth0 domain).

```
fedIdpIds: '["Domain"]'
fedIdpNames: '["Auth0"]'
fedIdpDisplayNames: '["Auth0"]'
fedIdpMetadatas: '["s3://${self:custom.settings.deploymentBucketName}/saml-metadata/auth0_com-metadata.xml"]'
```
Finally, redeploy the system using the `scripts/environment-deploy.sh STAGE_NAME` command.
The reference documentation can be found [here](https://aws.amazon.com/premiumsupport/knowledge-center/auth0-saml-cognito-user-pool/).

## References:

+ [Integrating Third-Party SAML Identity Providers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-integrating-3rd-party-saml-providers.html)
+ [Adding SAML IdPs to a user pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html)
