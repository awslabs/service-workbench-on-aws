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



