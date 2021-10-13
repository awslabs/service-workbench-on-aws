#!/bin/bash
set -e

# Get args
pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
# shellcheck disable=SC1091
[[ $UTIL_SOURCED != yes && -f ./util.sh ]] && source ./util.sh
popd > /dev/null

STAGE="$1"

# Dynamically set versionNumber and versionDate
# Get the first header (not Changelog) in CHANGELOG.md
versionLine="$(cat CHANGELOG.md | grep -m 1 "[0-9]\+\.[0-9]\+\.[0-9]\+\|Beta")"

# Get version number
versionNumber="$(echo $versionLine | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+\|Beta" | head -n 1)"

# Get version date (or generate if beta)
if [ "$versionNumber" == "Beta" ]
then
    latestReleaseVersion="$(cat CHANGELOG.md | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" | head -n 1)"
    versionDate="Latest Release Version: $latestReleaseVersion"
else
    versionDate="$(echo $versionLine | grep -o "[0-9][0-9][0-9][0-9]\-[0-9][0-9]\-[0-9][0-9]")"
fi

# Is there a stage.yml file?
FILE="main/config/settings/$STAGE.yml"
if [ -f "$FILE" ]
then
    # Yes-->Is there a versionDate and versionNumber key?
    if (cat "$FILE" | grep -q "versionDate") && (cat "$FILE" | grep -q "versionNumber")
    then
        # Yes-->Are they different from above?
        oldVersionNumber="$(cat "$FILE" | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+\|Beta" | head -n 1)"
        oldVersionDate="$(cat "$FILE" | grep -o "[0-9][0-9][0-9][0-9]\-[0-9][0-9]\-[0-9][0-9]\|Latest Release Version: [0-9]\.[0-9]\.[0-9]")"
        if ([ "$oldVersionNumber" != "$versionNumber" ]) || ([ "$oldVersionDate" != "$versionDate" ])
        then
            # Yes-->Replace new with old
            sed -i -e "s/versionNumber: '$oldVersionNumber/versionNumber: '$versionNumber/" "$FILE"
            sed -i -e "s/versionDate: '$oldVersionDate/versionDate: '$versionDate/" $FILE
        fi
    else
        # No-->Append new
        echo "
# Version number of current release
versionNumber: '${versionNumber}'

# Release date of current release
versionDate: '${versionDate}'" >> "$FILE"
    fi
else
    # No-->Make file and append new
    echo "# Version number of current release
versionNumber: '${versionNumber}'

# Release date of current release
versionDate: '${versionDate}'" >> "$FILE"
fi
