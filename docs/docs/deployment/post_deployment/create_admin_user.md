---
id: create_admin_user
title: Create an administrator user
sidebar_label: Create an administrator user
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Once you create an [Account](/deployment/post_deployment/link_aws_account) and an [Index and Project](/deployment/post_deployment/create_index_project), you must create an administrator user in the ‘**Users**’ tab. See **Figure 7**.

<img src={useBaseUrl('img/deployment/post_deployment/create_user_00.jpg')} />

_**Figure: Create an administrator**_ 


_**Note**: A root user account will already be created, however, you must not routinely use the root user account._ 

For testing purposes, you can create a local user by choosing  **Add Local User**. Assign the user the administrator’s role, and associate the user with the **Project** you created, and set the status to **Active**. 

<img src={useBaseUrl('img/deployment/post_deployment/create_user_01.jpg')} />

_**Figure: Add local user**_

In production environments we highly recommend using an IDP. For more details, refer to the *Service Workbench Configuration Guide*.
