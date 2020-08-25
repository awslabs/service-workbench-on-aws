---
id: configuring_auth0
title: Auth0 Setup Introduction
sidebar_label: Configuring Auth0
---

import useBaseUrl from '@docusaurus/useBaseUrl';

## Prerequisites

These instructions require an existing account with auth0.com.

## Create Application

Log into your account at [auth0.com](http://auth0.com/) and navigate to the 'Applications’ page.
If one does not already exist for Service Workbench’s use, create an Auth0 application by clicking the Create Application button:
<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0001.png')} />

Select Single Page Web Applications as the type, then click Create.
<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0002.png')} />

## Configure SAML2

Go to the Addons tab and enable SAML2 Web App.
<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0003.png')} />

In the Application Callback URL field, paste the following, replacing `STAGE_NAME` and `SOLUTION_NAME` with the values from the Service Workbench settings file, and replace `REGION` with the appropriate region:

```
https://`STAGE_NAME-SOLUTION_NAME`.auth.REGION.amazoncognito.com/saml2/idpresponse
```

<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0004.png')} />

Paste the following JSON into the Settings block, replacing `USER_POOL_ID` with the Service Workbench Cognito user pool ID value (found in the Cognito console), and the logout callback `STAGE_NAME`, `SOLUTION_NAME`, and `REGION` as before.

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

Scroll to the bottom and click Save.

## Download SAML Metadata

Click on the SAML2 Web App button again, and go to the Usage tab. Click on Download to download the SAML metadata XML file locally.
<img src={useBaseUrl('img/deployment/configuration/auth/auth0/0005.png')} />

Rename and place this downloaded file in the repository at in `main/solution/post-demployment/config/saml-metadata/auth0_com-metadata.xml`.

## Configure Environment

Add the following items to the `$STAGE.yml` settings file for the environment (replace `DOMAIN` with the domain of your Auth0:

```
fedIdpIds: '["DOMAIN"]'
fedIdpNames: '["Auth0"]'
fedIdpDisplayNames: '["Auth0"]'
fedIdpMetadatas: '["s3://${self:custom.settings.deploymentBucketName}/saml-metadata/auth0_com-metadata.xml"]'
```

Re-deploy the system using the `scripts/environment-deploy.sh STAGE_NAME` command.

Reference: https://aws.amazon.com/premiumsupport/knowledge-center/auth0-saml-cognito-user-pool/
