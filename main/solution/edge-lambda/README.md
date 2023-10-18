
# Lambda@Edge
This component deploys a Lambda@Edge function that intercepts website Amazon CloudFront `origin-response` and adds various 
security related HTTP headers in the response before serving the website content from S3.

## Packaging and deploying

To deploy:

```bash
$ pnpx serverless deploy --stage <environment-name>
```
