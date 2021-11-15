#!/usr/bin/env bash
# Display human readable result
pnpm audit --audit-level high --prod;

# Parse results
pnpm audit --json --audit-level high --prod > audit-results.json
high_vul=$(cat audit-results.json | jq '.metadata.vulnerabilities.high')
critical_vul=$(cat audit-results.json | jq '.metadata.vulnerabilities.critical')

high_vul_threshold=4
critical_vul_threshold=0
printf "\nHigh vulnerabilities threshold set at $high_vul_threshold\n"
echo "Critical vulnerabilities threshold set at $critical_vul_threshold"

if (($high_vul > $high_vul_threshold)) || (($critical_vul > $critical_vul_threshold)); then
  echo "Number of security vulnerabilities exceeded threshold"
  echo "High vulnerabilities detected: $high_vul"
  echo "Critical vulnerabilities detected: $critical_vul"
  exit 1
else
  exit 0
fi
