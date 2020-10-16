#!/usr/bin/env bash


# Install R and RStudio
sudo amazon-linux-extras install -y R3.4
rstudio_rpm="rstudio-server-rhel-1.3.959-x86_64.rpm"
curl -s "https://download2.rstudio.org/server/centos6/x86_64/${rstudio_rpm}" > "/tmp/rstudio/${rstudio_rpm}"
sudo yum install -y "/tmp/rstudio/${rstudio_rpm}"
sudo systemctl enable rstudio-server
sudo systemctl restart rstudio-server


# Create a user for RStudio to use; its password is set at boot time
sudo useradd -m rstudio-user


# Install and configure nginx
sudo amazon-linux-extras install -y nginx1
sudo openssl dhparam -out "/etc/nginx/dhparam.pem" 2048
sudo mv "/tmp/rstudio/cert.pem" "/etc/nginx/"
sudo mv "/tmp/rstudio/cert.key" "/etc/nginx/"
sudo mv "/tmp/rstudio/nginx.conf" "/etc/nginx/"
sudo chown -R nginx:nginx "/etc/nginx"
sudo chmod -R 600 "/etc/nginx"
sudo systemctl enable nginx
sudo systemctl restart nginx


# Install script that sets the service workbench user password at boot
sudo mv "/tmp/rstudio/secret.txt" "/root/"
sudo chown root: "/root/secret.txt"
sudo chmod 600 "/root/secret.txt"
sudo mv "/tmp/rstudio/set-password" "/usr/local/bin/"
sudo chown root: "/usr/local/bin/set-password"
sudo chmod 775 "/usr/local/bin/set-password"
sudo crontab -l 2>/dev/null > "/tmp/crontab"
echo '@reboot /usr/local/bin/set-password 2>&1 >> /var/log/set-password.log' >> "/tmp/crontab"
sudo crontab "/tmp/crontab"

# Install script that checks idle time and shuts down if max idle is reached
sudo mv "/tmp/rstudio/check-idle" "/usr/local/bin/"
sudo chown root: "/usr/local/bin/check-idle"
sudo chmod 775 "/usr/local/bin/check-idle"
sudo crontab -l 2>/dev/null > "/tmp/crontab"
echo '*/2 * * * * /usr/local/bin/check-idle 2>&1 >> /var/log/check-idle.log' >> "/tmp/crontab"
sudo crontab "/tmp/crontab"


# Wipe out all traces of provisioning files
rm -rf "/tmp/rstudio"
