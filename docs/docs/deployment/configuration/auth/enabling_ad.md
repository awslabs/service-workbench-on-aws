---
id: enabling_ad
title: Enabling AD
sidebar_label: Enabling AD
---

## Enable Active Directory Authentication

- Create a Cognito User Pool
    - The name of the pool must be ``<stage>-<solution_name>-userPool``, where **stage** and **solution_name** are as configured in the main configuration file.
- Gather the relying party information for AD integration (User Pool ID, Relying Party ID, User Pool Signing Cert etc)
- Run the script `scripts/get-relying-party.sh`.  Supply the output of this script to your Active Directory administrator

See more on adding:
- [an IDentityProvider](/deployment/configuration/auth/configuring_idp)
- [Auth0](/deployment/configuration/auth/configuring_auth0)
