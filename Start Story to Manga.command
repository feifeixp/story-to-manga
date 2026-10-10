#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
runtime_bin="$project_dir/../.runtime/node_modules/node/bin"
if [ -x "$runtime_bin/node" ]; then
  PATH="$runtime_bin:/opt/homebrew/bin:$PATH"
else
  PATH="/opt/homebrew/bin:$PATH"
fi
export PATH
cd "$project_dir"
exec pnpm dev --hostname 127.0.0.1
