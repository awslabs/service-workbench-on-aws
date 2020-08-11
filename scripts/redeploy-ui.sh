#!/bin/bash

# simple script to run the re-deployment steps for the UI
# Usage: 
#     scripts/redeploy-ui.sh <STAGE>
#
# Example for user that has deployed with stage "I_<3_AWS":
#     scripts/redeploy-ui.sh I_<3_AWS

cd addons/addon-base-raas-ui/packages/base-raas-ui
pnpm run babel
cd -

cd main/solution/ui
pnpx sls package-ui --stage $1 --local=true
pnpx sls package-ui --stage $1
pnpx sls deploy-ui --stage $1 --invalidate-cache=true
cd -