$environmentInfoStr =  $env:APPSTREAM_SESSION_CONTEXT
$ec2User = "Administrator"
if ($env:UserName -match "^ImageBuilderAdmin$") {
    & "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
} else {
    $environmentInfo =  $environmentInfoStr | ConvertFrom-Json

    if ($?)
    {
        $pacFileContent = @"
function FindProxyForURL(url, host) {
    const envInfo = JSON.parse('$environmentInfoStr');
    const allowedHosts = envInfo.hosts || [];

    let allowDirect = false;
    for(let i = 0; i < allowedHosts.length; ++i) {
        // If the hostname matches, send direct i.e., without any proxy.
        allowDirect = dnsDomainIs(host, allowedHosts[i]);
        if(allowDirect) {
            break;
        }
    }

    if (allowDirect) {
        return "DIRECT";
    }

    // DEFAULT RULE: All other traffic, use below proxy that just loops back to itself i.e., effectively blocking the traffic
    return "PROXY 127.0.0.1:3128;";
}
"@
        Set-Content -Path C:\App\proxy-config.pac -Value $pacFileContent
        & "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" --kiosk $environmentInfo.url
    }
}