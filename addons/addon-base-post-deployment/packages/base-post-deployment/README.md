## To invoke post deployment locally

After you run

```
$ pnpx sls deploy -s <stage>
```

You can invoke lambda locally

```
$ pnpx sls invoke local -f postDeployment -s <stage>
```
