---
id: activedirectory
title: Configuring Service Workbench using Microsoft Active Directory
sidebar_label: Configuring Service Workbench using Microsoft Active Directory
---
import useBaseUrl from '@docusaurus/useBaseUrl';

### Updating accounts

You can use Microsoft Active Directory to create and manage domains, users, and objects within a network. It provides a way to organize a large number of users into logical groups and subgroups. It also provides access control at each level. For more information about IdPs, see [Identity Providers](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/identity-providers).

Microsoft Active Directory (or any IdP) is a source of authentication. It authenticates users for Service Workbench login. After successful Active Directory login, it sends user information to an Amazon Cognito user pool created by Service Workbench. Service Workbench then uses the Amazon Cognito user pool for its internal use as described in [Service Workbench and IdP workflow](/configuration_guide/workflow).

To configure Active Directory authentication:

1. Create an IdP if you don’t have one. For more information about creating an IdP, see [sign up your organization](https://docs.microsoft.com/en-us/azure/active-directory/fundamentals/sign-up-organization).
2. Download SAML metadata (XML file).
3. Using Amazon Cognito on the AWS Management Console, create an Amazon Cognito user pool. The name of the pool must be `<stage>-<solution_name>-userPool`, where`stage` and `solution_name` are configured in the main configuration file.
4. Gather the relying party information, such as `User Pool Id`, `Relying Party Id`, and `User Pool Signing Cert`.
5. Run the following script from the root of Service Workbench repository: 
 `scripts/get-relying-party.sh`
6. Copy the output of this script and provide it to your Active Directory administrator.

<img src={useBaseUrl('img/deployment/post_deployment/scripts.png')} />

**Figure: Script output**