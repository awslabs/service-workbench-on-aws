# Install Putty using Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

choco install -y putty.install

$customFirefoxLauncherPath = "C:\App"
If(!(test-path $customFirefoxLauncherPath))
{
      New-Item -ItemType Directory -Force -Path $customFirefoxLauncherPath
}

Invoke-WebRequest -Uri https://raw.githubusercontent.com/awslabs/service-workbench-on-aws/feat-appstream-ui/scripts/app-stream/ec2linux.ps1 -OutFile 'C:\App\ec2linux.ps1'

# Add Applications

cd "C:\Program Files\Amazon\Photon\ConsoleImageBuilder"

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\putty.exe" --display-name Putty --name Putty

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files\PuTTY\puttygen.exe" --display-name PuttyGen --name PuttyGen

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\notepad.exe" --display-name Notepad --name Notepad

.\image-assistant.exe add-application --absolute-app-path "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" --display-name Firefox --name Firefox

.\image-assistant.exe add-application --absolute-app-path "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" --display-name EC2Linux --name EC2Linux --launch-parameters " -file \`"C:\App\ec2linux.ps1\`" -ExecutionPolicy Bypass"

# Create App
$ImageName="ServiceWorkbench_v1_" + $(Get-Date -Format "MM-dd-yyyy-hh-mm-ss")
.\image-assistant.exe create-image --name $ImageName
