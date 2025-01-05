#!/bin/bash

set -e

SCRIPT_DIR="$(dirname $0)"
cd "$SCRIPT_DIR/.."

if [ "$(docker images -q athena-ai/athena-core:latest 2> /dev/null)" == "" ]; then
    scripts/build_docker.sh
fi

if [ "$(docker ps -a -q -f name=athena-core)" ]; then
    docker start -ai athena-core | tee -a athena-core.log
    exit 0
fi

docker run --name athena-core -v "$(pwd)/configs:/app/configs" --net=host -it athena-ai/athena-core:latest | tee -a athena-core.log
