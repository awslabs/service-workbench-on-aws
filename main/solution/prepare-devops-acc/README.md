# A utility component to prepare DevOps account to maintain central AMIs

The component creates AWS IAM role in the DevOps account and adds trust policy in the role
to grant AssumeRole permissions to the main account. The solution deployed in the main account assumes this role to share product AMIs and Appstream images to project accounts.

## Packaging and deploying

To deploy:

```bash
$ pnpx sls deploy --stage <stage name>
```
