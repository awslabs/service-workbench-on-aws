# Install Putty using Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

choco install -y putty.install

# Add Applications

cd "C:\Program Files\Amazon\Photon\ConsoleImageBuilder"

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\putty.exe" --display-name Putty --name Putty

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\puttygen.exe" --display-name PuttyGen --name PuttyGen

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\notepad.exe" --display-name Notepad --name Notepad

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" --display-name Firefox --name Firefox

# Create App
$ImageName="ServiceWorkbench_v1_" + $(Get-Date -Format "MM-dd-yyyy-hh-mm-ss")
.\image-assistant.exe create-image --name $ImageName