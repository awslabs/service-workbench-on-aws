---
id: deployment_instance
title: Deployment Instance
sidebar_label: Deployment Instance
---

You can create a deployment instance with the following specifications:
* **Amazon EC2 Instance Type**: Use a T2.medium (4 GB) Amazon EC2 instance or larger. Larger machines will have faster networking and larger disks will have higher performance.
* **VPC and Subnets**: Use the default VPC and subnet.
* **AWS IAM Role**: Attach to your instance an AWS IAM role with sufficient permission, such as the administrator access. For more information, see [Add an IAM role to an instance](/deployment/reference/iam_role).
