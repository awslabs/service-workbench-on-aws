---
id: introduction
title: Sidebar Introduction
sidebar_label: Sidebar Introduction
---

import useBaseUrl from '@docusaurus/useBaseUrl';

This section of the documentation aims to provide an overview of how to operate the web-based user portal that is provided as part of this solution.
The User portal presents itself with a menu bar on the left side (sidebar) of the screen with a set of icons linking to different functionality of the web interface.

Based on the role a user holds when logged into the user interface, some or all menu items will be available.
The goal is to present a user only with those entries that are relevant for their work and not confuse them with additional, irrelevant, entries.

The following entries are available in the sidebar based on a user's role.

<table>
<tr>
<td width="150">
<img src={useBaseUrl('img/deployment/reference/admin_interface_00.jpg')} height="100%" width="100%" />
</td>
<td>
<b>Dashboard</b>

Displays spending over the past 30 days

<b>Auth</b>

Lists the Authentication Providers configured in Service Workbench. This
includes Default (local accounts) and any Active Directory id     entity
providers.

<b>Users</b>

Create and manage local and federated users and roles.

<b>Workflows</b>

Monitor and see the history of operations initiated by the
administrative interface. This includes provisioning an [Account](/deployment/post_deployment/link_aws_account) and creating and deleting a [Workspace](/user_guide/sidebar/common/workspaces/introduction)

<b>Accounts</b>

Create and manage accounts. See: [Account Structure](/user_guide/account_structure) for the
relationship between AWS accounts and Service Workbench accounts, and [Account](/deployment/post_deployment/link_aws_account) for administrative
actions.

<b>Studies</b>

See: [Studies](/user_guide/sidebar/common/studies/introduction)

<b>Workspaces</b>

See: [Workspaces](/user_guide/sidebar/common/workspaces/introduction)

</td>
</tr>
</table>
