# AWS account(s) terminology
## Overview

There are 3 types of AWS accounts roles in play.

* The __Main__ AWS account. This is where the RaaS application is running in.  
* The __Master__ AWS account. This (optional) account can be the same as the Main AWS account or a different one. It hosts the AWS Organizations, needed if the AWS account creation functionality is exercised.
* The __Member__ (or researcher) account(s). These accounts are exactly where the analytics run. These accounts are either member accounts in the organization ('created' accounts) or standalone accounts ('invited' or 'added' accounts).


## Creating an AWS account (Member):
The Main AWS account will assume a (master) role in the Master AWS account, then create a Member AWS account there. Then it will assume role in the Member AWS account and launch an AWS CloudFormation stack in there to build resources (VPC, Subnet, cross account execution role). See `solution/packages/cfn-templates/lib/templates/onboard-account.yaml`

## Inviting an AWS account (Member)
Invited account should provide a VPC and one Subnet in it, along with a cross account execution role. Trust permissions and execution permissions associated with this cross account execution role should be a superset than those described under _'The cross account execution Role'_ section further in this document.

## Launching an EMR in a Member account:
The Main AWS account assumes cross account execution role in Member AWS account and launches/reaps resources.


## The Master Role
* Resides in Master AWS account.
* Is assumed by the Main AWS account.

### Trust Policy
```
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
### Permissions
Managed Policy: AWSOrganizationsFullAccess

```
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
The above can be restricted to `createAccount`, `describeCreateAccountStatus` and `describeAccount` only.

Inline Policy: sts:AssumeRole for the controlling role between Master AWS account and Member AWS account: OrganizationAccountAccessRole

```
{
    "Version": "2012-10-17",
    "Statement": {
        "Effect": "Allow",
        "Action": "sts:AssumeRole",
        "Resource": "arn:aws:iam::*:role/OrganizationAccountAccessRole"
    }
}
```

## The cross account execution Role
* Resides in Member AWS account.
* Is assumed by the Main AWS account.
* When creating a Member AWS account in the organization of the Master AWS account, this role is created by the `solution/packages/cfn-templates/lib/templates/onboard-account.yaml` template.

### Trust Policy
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::${MainAccount}:role/${ApiHandlerRole}",
          "arn:aws:iam::${MainAccount}:role/${WorkflowLoopRunnerRole}",
          "arn:aws:iam::${MemberAccount}:root"
        ]
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
The principals listed above are:

* ApiHandlerRole: A role in the Main AWS account associated with the RaaS backend API execution.
* WorkflowLoopRunnerRole: A role in the Main AWS account associated with background workflow execution as initiated by backend API calls. 
* The Member AWS account itself.

### Permissions
These policies support running analytics.

* cloud formation

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
```

* cost explorer

```
{
    "Statement": {
        "Action": [
            "ce:*"
        ],
        "Resource": "*",
        "Effect": "Allow"
    }
}
```

* EC2

```
{
    "Statement": {
        "Action": [
            "ec2:*"
        ],
        "Resource": "*",
        "Effect": "Allow"
    }
}
```

* EMR

```
{
    "Statement": {
        "Action": [
            "elasticmapreduce:*"
        ],
        "Resource": "*",
        "Effect": "Allow"
    }
}
```

* IAM

```
{
    "Statement":[{
      "Sid": "iamRoleAccess",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:CreateRole",
        "iam:TagRole",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:DeleteRole",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::<aws-account-id-where-analytics-env-needs-to-run>:role/analysis-*"
    },
    {
      "Sid": "iamInstanceProfileAccess",
      "Effect": "Allow",
      "Action": [
        "iam:AddRoleToInstanceProfile",
        "iam:CreateInstanceProfile",
        "iam:GetInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile"
      ],
      "Resource": "arn:aws:iam::<aws-account-id-where-analytics-env-needs-to-run>:instance-profile/analysis-*"
    },
    {
      "Sid": "iamRoleServicePolicyAccess",
      "Effect": "Allow",
      "Action": [
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy"
      ],
      "Resource": "arn:aws:iam::<aws-account-id-where-analytics-env-needs-to-run>:role/analysis-*",
      "Condition": {
        "ArnLike": {
          "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AmazonElasticMapReduceRole"
        }
      }
    },
    {
      "Sid": "iamServiceLinkedRoleCreateAccess",
      "Effect": "Allow",
      "Action": [
        "iam:CreateServiceLinkedRole",
        "iam:PutRolePolicy"
      ],
      "Resource": "arn:aws:iam::*:role/aws-service-role/elasticmapreduce.amazonaws.com*/AWSServiceRoleForEMRCleanup*",
      "Condition": {
        "StringLike": {
          "iam:AWSServiceName": [
            "elasticmapreduce.amazonaws.com",
            "elasticmapreduce.amazonaws.com.cn"
          ]
        }
      }
    }]
}
```

* S3

```
{
    "Statement": {
        "Action": [
            "s3:*"
        ],
        "Resource": "*",
        "Effect": "Allow"
    }
}
```

* SageMaker

```
{
    "Statement": {
        "Action": [
            "sagemaker:*"
        ],
        "Resource": "*",
        "Effect": "Allow"
    }
}
```

* SSM

```
{
    "Statement": {
        "Action": [
            "ssm:*"
        ],
        "Resource": "*",
        "Effect": "Allow"
    }
}
```

