---
id: create_index_project
title: Create Indexes and Projects
sidebar_label: Create Indexes and Projects
---
import useBaseUrl from '@docusaurus/useBaseUrl';

Projects and Indexes form a heirarchy under Accounts. Each Account can
have multiple Indexes, each Index can have multiple Projects. Projects
are attached to Users, so the Projects must be created first.

After an [Account](/deployment/post_deployment/link_aws_account) has
been created, in the **Accounts** tab of the administrative interface,
create an Index that links to the Account, selecting the Account ID from
the drop-down list.

<img src={useBaseUrl('img/deployment/post_deployment/create_index_00.jpg')} />

Then create a Project that links to the new Index.

<img src={useBaseUrl('img/deployment/post_deployment/create_index_01.jpg')} />
