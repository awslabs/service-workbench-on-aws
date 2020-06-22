## Packaging and deploying

To package locally (to populate .env.local only)

```
$ pnpx sls package-ui --stage <stage name> --local=true
```

To package for deployment (to populate .env.production and create a build via "npm build")

```
$ pnpx sls package-ui --stage <stage name>
```

To run locally

```
$ pnpx sls start-ui --stage <stage name>
```

To deploy to S3

```
$ pnpx sls deploy-ui --stage <stage name> --invalidate-cache=true
```

## Useful commands

To list all resolved variables

```
$ pnpx sls print --stage <stage name>
```
