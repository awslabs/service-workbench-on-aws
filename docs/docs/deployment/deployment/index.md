---
id: index
title: Deployment Procedure
sidebar_label: Deployment Procedure
---

## Run main deployment script

- Run `scripts/environment-deploy.sh <stage>`, which will deploy the full solution based upon the configuration files previously created, if any.  This step takes 15--20 minutes
- After the deployment has successfully finished, take a note of its CloudFront URL, and the root password.  This information can be retrieved later by running `scripts/get-info.sh <stage>`
- You can now log in to your Service Workbench deployment using the link above, and user **root**. The root user will be used only to create administrative users, which is covered in [Post Deployment](/deployment/post_deployment/index)

## Deploy the machine-images SDC

The machine-images SDC provides the ability to launch EC2 images from within Service Workbench. The default Service Workbench installation currently provides Sagemaker, EMR, and Linux and Windows EC2 as workspace options. The EC2 and EMR options will not be available unless you have the corresponding machine images created.

Note that his step takes 15 minutes, and may be run concurrently with the main deployment script, above.  You can choose to create your own machine image if you do not wish to use the ones included in this SDC

Follow the steps outlined in `main/solution/machine-images/README.md`:
  - Install Packer (<https://www.packer.io/>). Packer is used to create a custom AMI which is then pushed to the Service Workbench deployment.
    - Fetch the package with curl or wget, unzip it and copy the **packer** executable to `/usr/local/bin`
```{.sh}
wget https://releases.hashicorp.com/packer/<ver>/packer_<ver>_linux_amd64.zip
unzip packer_<ver>_linux_amd64.zip
sudo cp packer /usr/local/bin/
```
  - Change directory to `/main/solution/machine-images`
  - Run `pnpx sls build-image -s <mystage>`.

- For examples of how to build a custom AMI, see:
  - `config/infra/packer-ec2-<platform>-workspace.json`
  - `config/infra/provisioners/provision-hail.sh`

