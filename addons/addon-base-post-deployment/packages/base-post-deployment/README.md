## To invoke post deployment locally

After you run

```
$ pnpx serverless deploy -s <stage>
```

You can invoke lambda locally

```
$ pnpx serverless invoke local -f postDeployment -s <stage>
```
