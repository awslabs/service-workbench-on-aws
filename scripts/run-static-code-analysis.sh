#!/usr/bin/env bash
pnpm --recursive --if-present --no-bail --filter @amzn/service-workbench-on-aws... run lint $@