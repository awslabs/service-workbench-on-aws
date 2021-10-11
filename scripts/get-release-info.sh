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





















































# Get the latest commit
# latestCommit="$(git log --pretty=oneline -n 1)"
# latestCommitDate="$(git log --date=short -n 1 | grep -o "[0-9][0-9][0-9][0-9]\-[0-9][0-9]\-[0-9][0-9]")"

# testing finding release
# latestCommit="e86fd0668aa6971e09491ab090586ce825f51069 feat: Encrypt s3 buckets for EMR log bucket and CICD Artifact bucket (#508)"
# latestCommitDate="2021-09-17"
# echo $latestCommitDate

# # If it is a PR
# # isPR="$(echo $latestCommit | grep "#")"
# if echo $latestCommit | grep -q "#"
# then
#     echo "PR"
#     # isRelease="$(echo $isPR | grep release)"
#     # echo "${isRelease}"
#     # echo "HERE"
#     # if [ -z "$isRelease" ]
#     if echo $latestCommit | grep -q "release"
#     then
#         # If it is a release PR
#         echo "Is a release PR"
#         releaseVersion="$(echo $latestCommit | grep -o "[0-9]\.[0-9]\.[0-9]")"
#         releaseDate=$latestCommitDate
#     else
#         echo "Not a release PR"
#         PRnumber="$(echo $latestCommit | grep -o "\#[0-9]*[0-9]")"
#         # isReleased="$(cat CHANGELOG.md | grep -n $PRnumber)"
#         if cat CHANGELOG.md | grep -n -q $PRnumber
#         then
#             # Else, find which release it was from
#             echo "Released"
#             releaseList="$(cat CHANGELOG.md | grep -n "\[[0-9]\.[0-9]\.[0-9]" | cut -f1 -d:)"
#             # IFS=$':' releaseArray=("$releaseList")
#             releaseArray=(${releaseList//$'\n' /})
#             # echo ${releaseArray[0]}
#             arrayLength=${#releaseArray[@]}
#             for (( i=0; i<${arrayLength}; i++))
#             do
#                 element=${releaseArray[$i]}
#                 # echo $element
#                 if [ "$(cat CHANGELOG.md | grep -n $PRnumber | cut -f1 -d:)"  -gt "$element" ]
#                 then
#                     releaseVersion="$(sed -n ${releaseArray[$i]}p CHANGELOG.md | grep -o "[0-9]\.[0-9]\.[0-9]" | head -n 1)"
#                     releaseDate="$(sed -n ${releaseArray[$i]}p CHANGELOG.md | grep -o "[0-9][0-9][0-9][0-9]\-[0-9][0-9]\-[0-9][0-9]")"
#                     # echo "After"
#                 fi
#             done
#         else
#             echo "Not released yet"
#             # Else, if it hasn't been included in a release
#             releaseVersion="Beta"
#             releaseDate=$latestCommitDate
#         fi
#     fi
# else
#     # If it is not a PR
#     echo "Not PR"
#     releaseVersion="Beta"
#     releaseDate=$latestCommitDate
# fi


# echo $releaseVersion \($releaseDate\)