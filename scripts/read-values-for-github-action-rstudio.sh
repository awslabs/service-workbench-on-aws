#!/bin/bash
set -e

FILE="main/config/settings/$STAGE_NAME.yml"

echo "
# Custom domain name for environment
domainName: '${AWS_DOMAIN_NAME_RSTUDIO}'

# Certs for custom domain
certificateArn: '${AWS_CERTIFICATE_ARN_RSTUDIO}'

# Hosted zone for custom domain routing
hostedZoneId: '${AWS_HOSTED_ZONE_ID_RSTUDIO}'" >> "$FILE"