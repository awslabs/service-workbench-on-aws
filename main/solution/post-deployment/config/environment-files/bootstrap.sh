#!/usr/bin/env bash

# This script bootstraps a workspace instance by preparing S3 study data to be
# mounted via the mount_s3.sh environment script.
# Note that mounting cannot be performed during initial bootstrapping
# because the instance's role will not yet have access to S3 study
# data since the associated resource policies aren't updated until after the
# CFN stack has been completed created.
S3_MOUNTS="$1"

# Exit if no S3 mounts were specified
[ -z "$S3_MOUNTS" -o "$S3_MOUNTS" = "[]" ] && exit 0

# Get directory in which this script is stored and define URL from which to download goofys
FILES_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Define a function to determine what type of environment this is (EMR, SageMaker, RStudio, or EC2 Linux)
env_type() {
    if [ -d "/usr/share/aws/emr" ]
    then
        printf "emr"
    elif [ -d "/home/ec2-user/SageMaker" ]
    then
        printf "sagemaker"
    elif [ -d "/var/log/rstudio-server" ]
    then
        printf "rstudio"
    else
        printf "ec2-linux"
    fi
}

# Define a function to update Jupyter configuration files
update_jupyter_config() {
    config_file="$1"

    # HACK: Update the default SessionManager class used by Jupyter notebooks
    # so that it runs the S3 mount script the first time sessions are listed
    cat << EOF | cut -b5- >> "$config_file"

    import subprocess
    from notebook.services.sessions.sessionmanager import SessionManager as BaseSessionManager

    class SessionManager(BaseSessionManager):
        def list_sessions(self, *args, **kwargs):
            """Override default list_sessions() method"""
            self.mount_studies()
            result = super(SessionManager, self).list_sessions(*args, **kwargs)
            return result

        def mount_studies(self):
            """Execute mount_s3.sh if it hasn't already been run"""
            if not hasattr(self, 'studies_mounted'):
                mounting_result = subprocess.run(
                    "mount_s3.sh",
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT
                )

                # Log results
                if mounting_result.stdout:
                    for line in mounting_result.stdout.decode("utf-8").split("\n"):
                        if line: # Skip empty lines
                            self.log.info(line)

                self.studies_mounted = True

    c.NotebookApp.session_manager_class = SessionManager
EOF
}

# Install dependencies
case "$(env_type)" in
    "emr") # Update config and restart Jupyter
        ;;
    "sagemaker") # Update config and restart Jupyter
        echo "Installing JQ"
        sudo mv "${FILES_DIR}/offline-packages/jq-1.5-linux64" "/usr/local/bin/jq"
        chmod +x "/usr/local/bin/jq"
        echo "Finish installing jq"
        ;;
    "ec2-linux") # Add mount script to bash profile
        echo "Installing ec2-instance-connect"
        sudo yum localinstall -y "${FILES_DIR}/offline-packages/ec2-linux/ec2-instance-connect-1.1-14.amzn2.noarch.rpm"
        echo "Finish installing ec2-instance-connect"
        echo "Installing jq"
        sudo mv "${FILES_DIR}/offline-packages/jq-1.5-linux64" "/usr/local/bin/jq"
        chmod +x "/usr/local/bin/jq"
        echo "Finish installing jq"
        ;;
    "rstudio") # Add mount script to bash profile
        export PATH="/usr/local/bin:$PATH"
        set-password
        echo "Installing jq"
        cp "${FILES_DIR}/offline-packages/jq-1.5-linux64" "/usr/local/bin/jq"
        chmod +x "/usr/local/bin/jq"
        echo "Finish installing jq"
        ;;
esac

echo "Copying Goofys from bootstrap.sh"
cp "${FILES_DIR}/offline-packages/goofys" /usr/local/bin/goofys
chmod +x "/usr/local/bin/goofys"

# Create S3 mount script and config file
echo "Mounting S3"
chmod +x "${FILES_DIR}/bin/mount_s3.sh"
ln -s "${FILES_DIR}/bin/mount_s3.sh" "/usr/local/bin/mount_s3.sh"
printf "%s" "$S3_MOUNTS" > "/usr/local/etc/s3-mounts.json"
echo "Finish mounting S3"

# Apply updates to environments based on environment type
case "$(env_type)" in
    "emr") # Update config and restart Jupyter
        yum install -y fuse-2.9.4   # As of 6/27/21 EMR has not been migrated to be air gapped
        update_jupyter_config "/opt/hail-on-AWS-spot-instances/src/jupyter_notebook_config.py"
        sudo -u hadoop PATH=$PATH:/usr/local/bin /opt/hail-on-AWS-spot-instances/src/jupyter_run.sh
        ;;
    "sagemaker") # Update config and restart Jupyter
        echo "Installing fuse"
        cd "${FILES_DIR}/offline-packages/sagemaker/fuse-2.9.4"
        sudo yum --disablerepo=* localinstall -y *.rpm
        echo "Finish installing fuse"
        update_jupyter_config "/home/ec2-user/.jupyter/jupyter_notebook_config.py"
        initctl restart jupyter-server --no-wait
        ;;
    "ec2-linux") # Add mount script to bash profile
        echo "Installing fuse"
        sudo yum localinstall -y "${FILES_DIR}/offline-packages/ec2-linux/fuse-2.9.2-11.amzn2.x86_64.rpm"
        echo "Finish installing fuse"
        printf "\n# Mount S3 study data\nmount_s3.sh\n\n" >> "/home/ec2-user/.bash_profile"
        ;;
    "rstudio") # Add mount script to bash profile
        echo "Installing fuse"
        sudo yum localinstall -y "${FILES_DIR}/offline-packages/ec2-linux/fuse-2.9.2-11.amzn2.x86_64.rpm"
        echo "Finish installing fuse"
        printf "\n# Mount S3 study data\nmount_s3.sh\n\n" >> "/home/rstudio-user/.bash_profile"
        ;;
esac

exit 0
