---
id: create_index_project
title: Create indexes and projects
sidebar_label: Create indexes and projects
---

import useBaseUrl from '@docusaurus/useBaseUrl';

Now that you have onboarded a hosting account, you can create indexes and projects associated to this account.

**Projects** and **Indexes** form a hierarchy under **Accounts**. Each account can have multiple **Indexes**, each **Index** can have multiple **Projects**. **Projects** are attached to **Users**, so you must create the **Projects** first.

After you create an [Account](/deployment/post_deployment/link_aws_account) in the **Accounts** tab of the administrative interface, create an **Index** that links to the account, by selecting the **Account ID** from the drop-down. 

1.	On the **Indexes** tab, choose **Add Index**. 

<img src={useBaseUrl('img/deployment/post_deployment/create_index_00.jpg')} />	

_**Figure: Create an index**_

2.	Create a **Project** that links to the new Index. In the **Projects** tab, choose **Add Project**. 

<img src={useBaseUrl('img/deployment/post_deployment/create_index_01.jpg')} />

_**Figure: Create a project**_

