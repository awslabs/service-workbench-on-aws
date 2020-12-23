---
id: enabling_ad
title: Enable Active Directory Authentication
sidebar_label: Enable Active Directory Authentication
---

import useBaseUrl from '@docusaurus/useBaseUrl';

To enable the Active Directory authentication, perform the following actions:
1. Using [Amazon Cognito](https://aws.amazon.com/cognito/?nc2=type_a) on the [AWS Management Console](https://aws.amazon.com/console/?nc2=type_a), create a **Cognito User Pool**.  The name of the pool must be ``<stage>-<solution_name>-userPool``, where **stage** and **solution_name** are as configured in the [main configuration file](/deployment/pre_deployment/configuration).
2. Gather the relying party information such as **User Pool ID**, **Relying Party ID**, **User Pool Signing Cert**, for the Active Directory integration.
3. Run the following script from the **root folder** of the project: 
```
scripts/get-relying-party.sh 
```
4.  Provide the output of this script to your Active Directory administrator. An example of the output is described in **Figure 19**.

<img src={useBaseUrl('img/deployment/configuration/enable_active_dir_00.png')} />

_**Figure 19: Relying Party Information**_

For more information on adding/enabling the Active Directory authentication, refer to the following:

- [an IDentityProvider](/deployment/configuration/auth/configuring_idp)
- [Auth0](/deployment/configuration/auth/configuring_auth0)
