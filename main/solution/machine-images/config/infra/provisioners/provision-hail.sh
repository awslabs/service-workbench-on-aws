#!/usr/bin/env bash

sudo yum remove java-1.7.0-openjdk -y
sudo yum install -y git java-1.8.0-devel
# Add /usr/local/bin to path for future shells
sudo sed -i /etc/profile -e "s#Path manipulation#Path manipulation\npathmunge /usr/local/bin#"
PATH=$PATH:/usr/local/bin

sudo chmod 777 /opt/
git clone https://github.com/hms-dbmi/hail-on-AWS-spot-instances.git /opt/hail-on-AWS-spot-instances

# Fake that this is a master to start with
sudo mkdir -p /mnt/var/lib/info
echo "isMaster true" | sudo tee -a /mnt/var/lib/info/instance.json

# Some jre cleanup
sudo rm /etc/alternatives/jre/include/include

# install things
cd /opt/hail-on-AWS-spot-instances/src
sudo ./bootstrap_python36.sh

# Update packages to make hail work as of hail 0.2.34
PACKAGES="humanize==1.0.0
  aiohttp
  aiohttp-session==2.7
  asyncinit
  gcsfs==0.2.1
  hurry.filesize
  nest-asyncio
  PyJWT
  pyspark==2.4.1
  python-json-logger
  tabulate==0.8.3
  tqdm==4.42.1
  bokeh==1.2.0
  pandas==0.25.3
  requests==2.21.0
  scipy==1.3"

sudo python3 -m pip install $PACKAGES

sudo python3 -m pip install -Iv jupyterlab==2.2.6

export HASH="current"
./hail_build.sh -v $HASH

# TODO: Consider adding jupyterlab-git plugin to enable notebook persistance via git

# Change the password of the notebook to 'go-research-on-aws'
sed -i 's/sha1:45f7d7ac038c:c36b98f22eac5921c435095af65a9a00b0e1eeb9/sha1:5fcaf700d85d:cd628e3a07b1db1f2cabd1beb11d3c32f4bde928/' ./jupyter_notebook_config.py

# Change the owner of the notebook directory to 'hadoop' (user UID will be 501 but doesn't exist yet)
sudo chown -R 501:501 /opt/hail-on-AWS-spot-instances/notebook

# clean up
sudo rm -rf /mnt/var
