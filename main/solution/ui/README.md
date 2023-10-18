## Packaging and deploying

To package locally (to populate .env.local only)

```
$ pnpx serverless package-ui --stage <stage name> --local=true
```

To package for deployment (to populate .env.production and create a build via "npm build")

```
$ pnpx serverless package-ui --stage <stage name>
```

To run locally

```
$ pnpx serverless start-ui --stage <stage name>
```

To deploy to S3

```
$ pnpx serverless deploy-ui --stage <stage name> --invalidate-cache=true
```

## Useful commands

To list all resolved variables

```
$ pnpx serverless print --stage <stage name>
```
