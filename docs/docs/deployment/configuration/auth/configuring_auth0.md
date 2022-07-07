---
id: configuring_auth0
title: Configure Auth0 and SAML2
sidebar_label: Configure Auth0 and SAML2
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Service Workbench on AWS can be configured to authenticate users through [Auth0][1] and SAML2. 
[1]: https://auth0.com/

## Configure Auth0
### Prerequisites

You must have an existing account with [Auth0][2] before attempting to complete these instructions.
[2]: https://auth0.com/

### Create Application

To create an application, log into your account at [Auth0][3]  and navigate to the ‘**Applications**’ page. If an application does not already exist for Service Workbench’s use, create an Auth0 application by clicking the ‘**Create Application**’ button. Then, select the application type as ‘**Single Page Web Applications**’ and click ‘**Create**'.
[3]: https://auth0.com/

**Figure 20** shows a screenshot image of the ‘**Applications**’ of [Auth0][4], while **Figure 21** displays a screenshot of the application types available after you click the ‘**Create Applications**’ button. 
[4]: https://auth0.com/

<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0001.png')} />

***Figure 20: Applications Webpage of Auth0.com***

<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0002.png')} />

***Figure 21: Application Types***

## Configure SAML2

To configure SAML2, navigate to the ‘**Addons**’ tab and enable the ‘**SAML2 Web App**’.

**Figure 22** shows a screenshot image of the ‘**Addons**’ tab for ‘**Single Page Web Applications**’. 

<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0003.png')} />

***Figure 22: Addons Tab for Single Page Web Applications***

In the ‘**Application Callback URL**’ field, paste the URL below, while replacing `STAGE_NAME` and `SOLUTION_NAME` with the values from the Service Workbench settings file and `REGION` with the appropriate region: 

```
https://`STAGE_NAME-SOLUTION_NAME`.auth.REGION.amazoncognito.com/saml2/idpresponse
```
**Figure 23** shows an image of the ‘**Application Callback URL**’ page and the settings.

<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0004.png')} />

***Figure 23: Application Callback URL Page and Settings***

Paste the JSON below into the settings block, replacing `<USER_POOL_ID>` with the Service Workbench Cognito User Pool ID value (found in the Amazon Cognito console. Replace the logout callback `<STAGE_NAME>`, `<SOLUTION_NAME>`, and `<REGION>` with the same values as you did in the previous step. Once you paste in the JSON with the appropriate values, scroll to the bottom and click ‘**Save**’.

```
{
  "audience": "urn:amazon:cognito:sp:USER_POOL_ID",
  "mappings": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
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

### Download SAML Metadata

To download SAML metadata, click on the ‘**SAML2 Web App**’ button again, and go to the ‘**Usage**’ tab. Select the  ‘**Download**’ option to download the SAML metadata XML file locally.

**Figure 24** shows the ‘**Usage**’ tab of the ‘**SAML2 Web App**’ page. 

<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0005.png')} />

***Figure 24: Usage Tab of the SAML2 Web Application***

Rename and place the downloaded file in the repository at the following location:

```
main/solution/post-demployment/config/saml-metadata/auth0_com-metadata.xml
```

### Configure Environment

Add the following items to the `$STAGE.yml` settings file for the environment (replace `DOMAIN` with the domain of your Auth0:

```
fedIdpIds: '["DOMAIN"]'
fedIdpNames: '["Auth0"]'
fedIdpDisplayNames: '["Auth0"]'
fedIdpMetadatas: '["s3://${self:custom.settings.deploymentBucketName}/saml-metadata/auth0_com-metadata.xml"]'
```

Finally, redeploy the system using the `scripts/environment-deploy.sh STAGE_NAME` command.

The reference documentation can be found [here][5]. 
[5]: https://aws.amazon.com/premiumsupport/knowledge-center/auth0-saml-cognito-user-pool/