#!/usr/bin/env bash
pnpm audit --json --audit-level high --prod > audit-results.json
high_vul=$(cat audit-results.json | jq '.metadata.vulnerabilities.high')
critical_vul=$(cat audit-results.json | jq '.metadata.vulnerabilities.critical')

high_vul_threshold=1
critical_vul_threshold=0

if (($high_vul > $high_vul_threshold)) || (($critical_vul > critical_vul_threshold)); then
  exit 1
else
  exit 0
fi
