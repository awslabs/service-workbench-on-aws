# Install Putty using Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

choco install -y putty.install

# Add Applications

cd "C:\Program Files\Amazon\Photon\ConsoleImageBuilder"

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\putty.exe" --display-name Putty --name Putty

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\puttygen.exe" --display-name PuttyGen --name PuttyGen

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\notepad.exe" --display-name Notepad --name Notepad

$firefoxDistPath = "C:\Program Files (x86)\Mozilla Firefox\distribution"
If(!(test-path $firefoxDistPath))
{
      New-Item -ItemType Directory -Force -Path $firefoxDistPath
}
Set-Content -Path "C:\Program Files (x86)\Mozilla Firefox\distribution\policies.json" -Value @"
{
    "policies": {
        "DontCheckDefaultBrowser": true,
        "DefaultDownloadDirectory": "${home}\\My Files\\Home Folder",
        "Proxy": {
            "Mode": "autoConfig",
            "Locked": true,
            "AutoConfigURL": "file:///c:/App/proxy-config.pac",
            "Passthrough": "<local>"
        }
    }
}
"@

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -file 'C:\App\firefox.ps1' -ExecutionPolicy Bypass" --display-name firefox --name firefox


# Create App
$ImageName="FirefoxPuttyNotepad_" + $(Get-Date -Format "MM-dd-yyyy-hh-mm-ss")
.\image-assistant.exe create-image --name $ImageName