---
id: introduction
title: Local Development Introduction
sidebar_label: Introduction
---

Once you have deployed the app and the UI, you can start developing locally on your computer. You will be running a local server that uses the same lambda functions code. To start local development, run the following commands to run a local server:

```bash
$ cd solution/backend
$ pnpx sls offline -s $STAGE
$ cd -
```

Then, in a separate terminal, run the following commands to start the ui server and open up a browser:

```bash
$ cd solution/ui
$ pnpx sls start-ui -s $STAGE
$ cd -
```