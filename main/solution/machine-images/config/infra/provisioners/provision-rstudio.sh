#!/usr/bin/env bash

# Various development packages needed to compile R
sudo yum install -y gcc gcc-gfortran gcc-c++
sudo yum install -y java-1.8.0-openjdk-devel
sudo yum install -y readline-devel zlib-devel bzip2-devel xz-devel pcre-devel
sudo yum install -y libcurl-devel libpng-devel cairo-devel pango-devel
sudo yum install -y xorg-x11-server-devel libX11-devel libXt-devel

# Install R from source (https://docs.rstudio.com/resources/install-r-source/)
R_VERSION="3.6.3"
mkdir -p "/tmp/R/"
curl -s "https://cran.rstudio.com/src/base/R-3/R-${R_VERSION}.tar.gz" > "/tmp/R/R-${R_VERSION}.tar.gz"
cd "/tmp/R/"
tar xvf "R-${R_VERSION}.tar.gz"
cd "R-${R_VERSION}/"
./configure --enable-memory-profiling --enable-R-shlib --with-blas --with-lapack
sudo make
sudo make install
cd "../../.."

# Install RStudio
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


# Install system packages necessary for installing R packages through RStudio CRAN [devtools, tidyverse]
sudo yum install -y git libcurl-devel openssl-devel libxml2-devel
libgit2_rpm="libgit2-0.26.6-1.el7.x86_64.rpm"
libgit2_devel_rpm="libgit2-devel-0.26.6-1.el7.x86_64.rpm"
mkdir -p "/tmp/libgit2/"
curl -s "http://mirror.centos.org/centos/7/extras/x86_64/Packages/${libgit2_rpm}" > "/tmp/libgit2/${libgit2_rpm}"
sudo yum install -y "/tmp/libgit2/${libgit2_rpm}"
curl -s "http://mirror.centos.org/centos/7/extras/x86_64/Packages/${libgit2_devel_rpm}" > "/tmp/libgit2/${libgit2_devel_rpm}"
sudo yum install -y "/tmp/libgit2/${libgit2_devel_rpm}"


# Other recommended system packages for installing R packages (https://docs.rstudio.com/rsc/post-setup-tool/)
sudo yum groupinstall -y 'Development Tools'            # Compiling tools 
sudo yum install -y libssh2-devel                       # Client SSH

sudo yum install -y libpng-devel libjpeg-turbo-devel    # Images
sudo yum install -y ImageMagick ImageMagick-c++-devel   # Images
sudo yum install -y cairo-devel libGLU-devel            # Graphs
sudo yum install freetype-devel harfbuzz-devel          # Font

sudo yum install -y mariadb-devel                       # MariaDB/MySQL client & server packages
sudo yum install -y unixODBC-devel                      # ODBC API client
sudo yum install -y gmp-devel                           # GNU MP arbitrary precision library

# Wipe out all traces of provisioning files
sudo rm -rf "/tmp/rstudio"
sudo rm -rf "/tmp/libgit2"
sudo rm -rf "/tmp/R"
