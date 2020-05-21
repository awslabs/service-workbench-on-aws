# A utility component to prepare RaaS master account containing main AWS Organization

The component creates the master AWS IAM role in the RaaS master account and adds trust policy in the role
to grant AssumeRole permissions to the main account. The solution deployed in the main account assumes this role
to create member account under the AWS Organization in the master account when you use "Create AWS Account" feature.
If you are not familiar with the terms `main account` vs `master account` vs the `member account` then please
read ["documentation/aws-accounts-readme.md"](../../documentation/aws-accounts-readme.md) first.

## Packaging and deploying

To deploy:

```bash
$ pnpx sls deploy --stage <stage name>
```
