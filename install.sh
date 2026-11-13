#!/usr/bin/env sh
# Installs the Hermes usage-meter desktop plugin (macOS / Linux).
# No packages, API keys or network access are needed.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source="$here/desktop/plugin.js"
hermes_home=${HERMES_HOME:-"$HOME/.hermes"}
name=${1:-hermes-usage-meter}
root="$hermes_home/desktop-plugins"

[ -f "$source" ] || { echo "Missing $source" >&2; exit 1; }
case "$name" in ''|.*|*/*|*..*) echo "Invalid folder name: $name" >&2; exit 1;; esac

# Update an earlier manual copy in 'usage-meter' instead of adding a duplicate plugin id.
if [ "$name" = hermes-usage-meter ] && [ -f "$root/usage-meter/plugin.js" ] &&
   grep -q "id:'usage-meter'" "$root/usage-meter/plugin.js"; then
  name=usage-meter
fi

target_dir="$root/$name"
target="$target_dir/plugin.js"
mkdir -p "$target_dir"
if [ -f "$target" ]; then
  cp -p "$target" "$target_dir/plugin.backup-$(date +%Y%m%d-%H%M%S).js"
fi

# Stage then rename, so the running app never hot-reloads a half-written file.
staged="$target_dir/.plugin.$$.tmp"
cp "$source" "$staged"
mv -f "$staged" "$target"

cmp -s "$source" "$target" || { echo "Copy verification failed for $target" >&2; exit 1; }
echo "Installed: $target"
echo "Hermes Desktop reloads disk plugins automatically. If the widget does not appear, use Plugins > Reload."
