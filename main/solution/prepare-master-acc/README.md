# A utility component to prepare Service Workbench master account containing main AWS Organization

The component creates the master AWS IAM role in the Service Workbench master account and adds trust policy in the role
to grant AssumeRole permissions to the main account. The solution deployed in the main account assumes this role
to create member account under the AWS Organization in the master account when you use "Create AWS Account" feature.

## Packaging and deploying

To deploy:

```bash
$ pnpx sls deploy --stage <stage name>
```
