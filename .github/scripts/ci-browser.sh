#!/usr/bin/env bash
# The test browser (Playwright's Chromium) and the system packages it needs, for the browser jobs in
# .github/workflows/apps-check.yml. Both come from caches the default branch keeps warm (the `warm`
# job), when they are there:
#   ~/.cache/ms-playwright   the browser, so it isn't downloaded again
#   ~/apt-archives           apt's .deb files (fonts, xvfb...), so a slow Ubuntu mirror can't hold
#                            a job up for minutes; apt still checks each is the newest
#   .github/scripts/ci-browser.sh [hit]    hit: the browser came from the cache
# A stalled mirror or download once held a job here for an hour, twice in a row: apt gives up on a
# server that stops answering and tries again, and each step gets 8 minutes before it starts over
# (3 tries), so a job fails in under half an hour at worst instead of hanging.
set -euo pipefail
try() {
  for n in 1 2 3; do
    timeout --kill-after=30s 8m "$@" && return 0
    echo "::warning::try $n of 3 didn't finish: $*"
    sudo dpkg --configure -a || true   # an install cut off part way
  done
  return 1
}
sudo mkdir -p "$HOME/apt-archives/partial"
printf 'Dir::Cache::Archives "%s/apt-archives";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\nAPT::Keep-Downloaded-Packages "true";\nAcquire::Retries "5";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nDPkg::Lock::Timeout "120";\n' "$HOME" \
  | sudo tee /etc/apt/apt.conf.d/90aos-ci > /dev/null
try npm install --global playwright@1.56.1
if [ "${1:-}" = hit ]; then try npx --yes playwright@1.56.1 install-deps chromium
else try npx --yes playwright@1.56.1 install --with-deps chromium; fi
# so the cache can read what apt (as root) downloaded
sudo chown -R "$(id -u):$(id -g)" "$HOME/apt-archives"
