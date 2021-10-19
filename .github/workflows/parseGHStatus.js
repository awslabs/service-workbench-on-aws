let apiResponse = JSON.parse(process.argv[2]);
let latestStatus = "";
let latestTime = 0;
apiResponse.forEach((status) => {
    let statusTime = (new Date(status.updated_at)).getTime();
    if (status.context === 'CodePipeline' && statusTime > latestTime) {
        latestTime = statusTime;
        latestStatus = status.state;
    }
})
console.log(latestStatus);