#!/usr/bin/env bash
# The test browser (Playwright's Chromium) and the system packages it needs, for the browser jobs in
# .github/workflows/apps-check.yml. Both come from caches the default branch keeps warm (the `warm`
# job), when they are there:
#   ~/.cache/ms-playwright   the browser, so it isn't downloaded again
#   ~/apt-archives           apt's .deb files (fonts, xvfb...), so a slow Ubuntu mirror can't hold
#                            a job up for minutes; apt still checks each is the newest
#   .github/scripts/ci-browser.sh [hit]    hit: the browser came from the cache
# apt runs here itself, as root under `timeout`, so a stuck update is really stopped and tried again:
# twice in a row an update hung for an hour after Azure's Ubuntu mirror stopped answering, and when
# only `npx playwright install-deps` was timed, the root apt-get it started kept running, holding
# apt's lock, so every try after the first failed at once. Each try gets a few minutes, 3 tries.
set -euo pipefail
try() {   # try <minutes> <command...>, as root
  local m=$1; shift
  for n in 1 2 3; do
    sudo timeout --kill-after=20s "${m}m" "$@" && return 0
    echo "::warning::try $n of 3 didn't finish: $*"
    sudo dpkg --configure -a || true   # an install cut off part way
  done
  return 1
}
sudo mkdir -p "$HOME/apt-archives/partial"
printf 'Dir::Cache::Archives "%s/apt-archives";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\nAPT::Keep-Downloaded-Packages "true";\nAcquire::Retries "3";\nDPkg::Lock::Timeout "60";\n' "$HOME" \
  | sudo tee /etc/apt/apt.conf.d/90aos-ci > /dev/null
timeout 5m npm install --global playwright@1.56.1
# the packages Playwright's Chromium needs on this Ubuntu (what `install-deps` would apt-get install)
pkgs=$(npx --yes playwright@1.56.1 install-deps --dry-run chromium | sed -n 's/.*--no-install-recommends \([^"]*\).*/\1/p')
[ -n "$pkgs" ] || { echo "::error::no package list from playwright install-deps --dry-run"; exit 1; }
try 3 apt-get update
# shellcheck disable=SC2086
try 6 env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $pkgs
[ "${1:-}" = hit ] || timeout 10m npx --yes playwright@1.56.1 install chromium
# so the cache can read what apt (as root) downloaded
sudo chown -R "$(id -u):$(id -g)" "$HOME/apt-archives"
