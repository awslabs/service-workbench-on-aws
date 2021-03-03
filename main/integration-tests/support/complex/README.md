This folder contains functions that perform complex setup/clean up logic, such as deleting a study or a user.

For each setup/clean up task that is complex, create a file in this folder. This file should export a function
that can accept at least two arguments: setup and aws. For an example, take a look at delete-study.js file.
