---
id: introduction
title: Introduction to AWS Accounts
sidebar_label: Introduction
---

There are 3 types of AWS accounts roles in this solution.

* The __Main__ AWS account. This is the account that this solution is running in.  
* The __Master__ AWS account. This (optional) account can be the same as the Main AWS account or a different one. It hosts AWS Organizations, needed if the AWS account creation functionality is required.
* The __Member__ (or researcher) account(s). These accounts are where researcher analytics are run. These accounts are either member accounts in the organization ('created' accounts) or standalone accounts ('invited' accounts).
