#!/usr/bin/env bash

# This script mounts S3 buckets/prefixes onto the local filesystem using fuse and
#   goofys. It also attempts to create a sym link to the mounted data if the instance
#   is an EMR or SageMaker instance so that it can be easily accessed by Jupyter notebooks.
#
# /usr/local/s3-mounts.json should contain S3 study data metadata of the form
#  [{
#   "id": "STUDY_ID",
#   "bucket": "BUCKET_NAME",
#   "prefix": "BUCKET_PREFIX"
# }, ...]
CONFIG="/usr/local/etc/s3-mounts.json"
MOUNT_DIR="${HOME}/studies"

# Exit if CONFIG doesn't exist or is 0 bytes
[ ! -s "$CONFIG" ] && exit 0

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

# Mount S3 buckets
mounts="$(cat "$CONFIG")"
num_mounts=$(printf "%s" "$mounts" | jq ". | length" -)
for ((study_idx=0; study_idx<$num_mounts; study_idx++))
do
    # Parse bucket/key info
    study_id="$(printf "%s" "$mounts" | jq -r ".[$study_idx].id" -)"
    s3_bucket="$(printf "%s" "$mounts" | jq -r ".[$study_idx].bucket" -)"
    s3_prefix="$(printf "%s" "$mounts" | jq -r ".[$study_idx].prefix" -)"

    # Mount S3 location if not already mounted
    study_dir="${MOUNT_DIR}/${study_id}"
    ps -U "$LOGNAME" -o "command" | egrep -q "goofys .* ${study_dir}$"
    if [ $? -ne 0 ]
    then
        printf 'Mounting study "%s" at "%s"\n' "$study_id" "$study_dir"
        mkdir -p "$study_dir"
        goofys --acl "bucket-owner-full-control" "${s3_bucket}:${s3_prefix}" "$study_dir"
    fi
done

# Define where the Jupyter notebook (if any) should be running
notebook_dir=""
case "$(env_type)" in
    "emr")
        notebook_dir="/opt/hail-on-AWS-spot-instances/notebook"
        ;;
    "sagemaker")
        notebook_dir="/home/ec2-user/SageMaker"
        ;;
esac

# Add a link to the mount in the notebook directory.
# (The user gets easy access, but it won't check the bucket into a git repo.)
# Only create a link if Jupyter is running, there are studies mounted, and the link
# doesn't already exist.
if [ -n "$notebook_dir" -a $num_mounts -ne 0 ]
then
    symlink_name="$notebook_dir/studies"
    [ ! -L "$symlink_name" ] && sudo ln -s "$MOUNT_DIR" "$symlink_name"
fi
