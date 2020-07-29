---
id: master_role
title: Master Account Role
sidebar_label: Master Account Role
---

This role resides in the [**Master AWS Account**](introduction) and is assumed by the [**Main AWS Account**](introduction).

## Master Role Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${MainAccount}:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": ${ExternalId}
        }
      }
    }
  ]
}
```

## Master Role Permissions

The follwing details the Managed and Inline Policy permissions needed.

### Managed Policy: AWSOrganizationsFullAccess

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "organizations:*",
            "Resource": "*"
        }
    ]
}
```

:::warning
You should restricted the actions to `createAccount`, `describeCreateAccountStatus` and `describeAccount` only.
:::

### Inline Policy: sts:AssumeRole

This policy is for the controlling role between [**Master AWS Account**](introduction) and [**Master AWS Account**](introduction):

```json
{
    "Version": "2012-10-17",
    "Statement": {
        "Effect": "Allow",
        "Action": "sts:AssumeRole",
        "Resource": "arn:aws:iam::*:role/OrganizationAccountAccessRole"
    }
}
```
