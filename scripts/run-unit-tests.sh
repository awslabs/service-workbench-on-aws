#!/usr/bin/env bash
pnpm --recursive --if-present --filter @amzn/service-workbench-on-aws... run test $@