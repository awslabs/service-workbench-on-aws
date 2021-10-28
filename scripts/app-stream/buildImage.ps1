# Install Putty using Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

choco install -y putty.install

Invoke-WebRequest -Uri https://raw.githubusercontent.com/awslabs/service-workbench-on-aws/mainline/scripts/app-stream/ec2linux.ps1 -OutFile 'C:\Users\Public\Documents\EC2Linux.ps1'

# Prepare remote desktop script with arguments
Set-Content C:\Users\public\Documents\MicrosoftRemoteDesktop.ps1 "mstsc /f /v:`"`$env:APPSTREAM_SESSION_CONTEXT`":3389"

# Add Applications

cd "C:\Program Files\Amazon\Photon\ConsoleImageBuilder"

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\putty.exe" --display-name Putty --name Putty

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\puttygen.exe" --display-name PuttyGen --name PuttyGen

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\notepad.exe" --display-name Notepad --name Notepad

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" --display-name Firefox --name Firefox

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
--display-name EC2Linux --name EC2Linux `
--launch-parameters '`"-File "C:\Users\Public\Documents\EC2Linux.ps1" -ExecutionPolicy Bypass`"'

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
--display-name MicrosoftRemoteDesktop --name MicrosoftRemoteDesktop `
--launch-parameters '`"-File "C:\Users\Public\Documents\MicrosoftRemoteDesktop.ps1" -ExecutionPolicy Bypass`"' `
--working-directory 'C:\Users\public\Documents\'

# Create App
$ImageName="ServiceWorkbench_v1_" + $(Get-Date -Format "MM-dd-yyyy-hh-mm-ss")
.\image-assistant.exe create-image --name $ImageName
