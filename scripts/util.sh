#!/usr/bin/env bash
set -e

UTIL_SOURCED=yes
export UTIL_SOURCED

# https://stackoverflow.com/questions/59895/how-to-get-the-source-directory-of-a-bash-script-from-within-the-script-itself
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

pushd "${DIR}/.."  > /dev/null
export SOLUTION_ROOT_DIR="${PWD}"
export SOLUTION_DIR="${SOLUTION_ROOT_DIR}/main/solution"
export CONFIG_DIR="${SOLUTION_ROOT_DIR}/main/config"
export INT_TEST_DIR="${SOLUTION_ROOT_DIR}/main/integration-tests"
popd > /dev/null

function init_package_manager() {
  PACKAGE_MANAGER=pnpm
  case "$PACKAGE_MANAGER" in
    yarn)
      EXEC="yarn run"
      RUN_SCRIPT="yarn run"
      INSTALL_RECURSIVE="yarn workspaces run install"
      ;;
    npm)
      EXEC="npx"
      RUN_SCRIPT="npm run"
      INSTALL_RECURSIVE=
      ;;
    pnpm)
      EXEC="pnpx"
      RUN_SCRIPT="pnpm run"
      export EXEC RUN_SCRIPT
      INSTALL_RECURSIVE="pnpm recursive install"
      ;;
    *)
      echo "error: Unknown package manager: '${PACKAGE_MANAGER}''" >&2
      exit 1
      ;;
  esac
}

function install_dependencies() {
  init_package_manager

  # Install
  pushd "$SOLUTION_DIR"
  [[ -n "$INSTALL_RECURSIVE" ]] && $INSTALL_RECURSIVE
  popd
}

function ensure_setttings_file() {
  # Accept 1st argument. Default: username
  STAGE=${1:-$USER}

  ENVIRONMENT_CONFIG=$CONFIG_DIR/settings/$STAGE.yml

  if ! test -f "$ENVIRONMENT_CONFIG"
  then
    printf "\nEnvironment configuration does not exist!"
    printf "\nPlease either create the environment configuration by copying demo.yaml or make sure you typed the environment name correctly!\n\n"
    printf "Exiting ...\n\n"
    exit
  fi
}
