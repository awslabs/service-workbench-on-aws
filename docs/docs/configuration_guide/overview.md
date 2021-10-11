---
id: overview
title: Identity Provider overview
sidebar_label: Identity Provider overview
---

An identity provider (IdP) is a service that stores, manages digital identities and verifies the identities of users. The IdP can be used in place of internal authentication mechanism of Service Workbench. The IdP authenticates the identity of a user, allowing Service Workbench to assign permissions to that user.

In an IdP workflow, user login is performed by an external identify provider. Examples of these include Amazon SSO, other SAML-2.0 identity providers such as Azure Active Directory (Azure AD), or social connections. After your identity is verified by the IdP, Service Workbench assigns you the rights to access the resources for which you are authorized. For more information about IdPs, see [Identity Providers for external entities](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/identity-providers).

## Prerequisites for configuring an IdP

- Create a SAML 2.0-compliant metadata file using IdP. Place the metadata file here:
 `main/solution/post-deployment/config/saml-metadata`
- Enter the following values in your `main/config/settings/<stage.yml>`:
 `fedIdpIds`, `fedIdpNames`, `fedIdpDisplayNames`, `fedIdpMetadatas`
  Examples for these are available in `main/config/settings/example.yml`
- Deploy Service Workbench