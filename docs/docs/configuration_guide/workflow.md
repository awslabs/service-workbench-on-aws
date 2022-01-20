---
id: workflow
title: Service Workbench and IdP workflow
sidebar_label: Service Workbench and IdP workflow
---

import useBaseUrl from '@docusaurus/useBaseUrl';

### Service Workbench and IdP workflow

While using Service Workbench, you are redirected to the configured IdP login page. Next, the IdP can authenticate using any backend authentication connection, such as an LDAP directory, or a database. The IdP data is then provided by Amazon Cognito user pool. Once you are authenticated, the IdP returns a Security Assertion Markup Language (SAML) metadata file to Service Workbench indicating that you have been successfully authenticated. It then provides user details (such as, name, email etc.) as shown below.

<img src={useBaseUrl('img/deployment/post_deployment/idp_workflow.png')} />

**Figure: IdP workflow using Service Workbench**

## Advantages of configuring Service Workbench using IdP

When Service Workbench is configured using an IdP, the login process is streamlined by allowing authentication federation and single sign-on (SSO) compatibility. Therefore, you can use an existing identity (and password) to log in. It also reduces the need to create custom logins and tracks user activity. Using IdP, a single login provides all data at one go.

You can access Service Workbench from a variety of devices, locations, and time zones. An IdP manages those details efficiently.

## Using native Amazon Cognito user pool for authentication

**Note**: As a security enhancement, the internal authentication method used by Service Workbench (the legacy default authentication method) will soon be deprecated. 

In Service Workbench 4.2.0, native Amazon Cognito user pool is the default authentication method, and is reflected accordingly on the application's login page (alongside your external SAML IdP integrations, if any).

<img src={useBaseUrl('img/deployment/configuration/auth1.png')} />

You will find the default (user-customizable) configurations determining the native Amazon Cognito user pool behavior in the `main/solution/post-deployment/config/settings/.defaults.yml` file.  

By default, you can sign up onto the native pool, but can only access Service Workbench once you are approved by the Service Workbench administrator. The user addition experience on Service Workbench for native Amazon Cognito user pool is similar to that of an external IdP.

A new administrator user is created in Service Workbench using the `rootUserEmail` value as provided by your stage configuration. A temporary password is available in the installation summary necessary for logging in the native administrator user for the first time.

## Log in using internal authentication

You can still log in to Service Workbench using the internal authentication method by adding `/?internal` to your Service Workbench URL (for example, `https://<random_string>.cloudfront.net/?internal`).

<img src={useBaseUrl('img/deployment/configuration/auth2.png')} />

**Important**: We suggest creating new users in native Amazon Cognito user pool (or an external IdP, if you use one) corresponding to their internal authentication counterparts, and migrating resource permissions over to these new users.




