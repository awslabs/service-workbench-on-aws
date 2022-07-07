#!/bin/bash
set -e

# Get the first header (not Changelog) in CHANGELOG.md
versionLine="$(cat CHANGELOG.md | grep -m 1 "[0-9]\+\.[0-9]\+\.[0-9]\+\|Beta")"

# Check if it contains the word Beta
if (echo "$versionLine" | grep -q "Beta")
then
    # Do nothing
    echo "Nothing to change in changelog--still Beta"
else
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
    git checkout develop
    # Add Beta header to changelog
    echo "Need to add to changelog"
    # Get latest release number
    latestReleaseVersion="$(cat CHANGELOG.md | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" | head -n 1)"
    # Create ed file
    echo "5i
## Beta
[This release is in beta. Click here to see changes since ${latestReleaseVersion}.](https://github.com/awslabs/service-workbench-on-aws/compare/v${latestReleaseVersion}...mainline)

.
w
q" > add-beta.ed
    # Change CHANGELOG.md with ed file
    ed CHANGELOG.md < add-beta.ed
    # delete ed file
    rm add-beta.ed
    # Commit and push new changelog
    git add CHANGELOG.md
    git commit -m "docs: Add Beta"
    git push origin develop
fi