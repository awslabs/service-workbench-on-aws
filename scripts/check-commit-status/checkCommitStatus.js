const { Octokit } = require("@octokit/rest");

async function run(args) {
    // https://docs.github.com/en/actions/learn-github-actions/contexts#github-context
    // repository format is `{owner}/{repoName}`
    const [gitHubToken, repository, sha] = args;
    const commitStatusToCheckFor = 'CodePipeline';
    const [owner, repo] = repository.split('/');
    console.log(`Checking ${commitStatusToCheckFor} status for commit ${sha}`)

    let latestStatus = "";
    const startTime = (new Date()).getTime();
    let waitTimePerApiCallInSeconds = 30;
    const totalWaitTimeInSeconds = 7200;

    const octokit = new Octokit({
        auth: gitHubToken,
    });

    let waitedForInSeconds = 0;
    while (!['success', 'error'].includes(latestStatus) &&  waitedForInSeconds < totalWaitTimeInSeconds) {
        // Latest commit status is at the top of the list
        // https://docs.github.com/en/rest/reference/repos#list-commit-statuses-for-a-reference
        const response = await octokit.rest.repos.listCommitStatusesForRef({owner, repo, ref: sha});
        const commitStatuses = response.data.filter((status) => {return status.context === commitStatusToCheckFor});
        if (commitStatuses.length > 0) {
            latestStatus = commitStatuses[0].state;
        }
        await new Promise(resolve => setTimeout(resolve, waitTimePerApiCallInSeconds * 1000));
        const currentTime = (new Date()).getTime();
        waitedForInSeconds = Math.floor((currentTime - startTime) / 1000);
        console.log(`Waited for ${waitedForInSeconds} seconds`);
    }
    if (latestStatus === 'success') {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

(async () => {
    await run(process.argv.slice(2))
})();
